import { GoogleGenAI, Type } from "@google/genai";
import { ReceiptData, ExpenseCategory } from "../types";

// Schema definition matching the user's specific output format requirements
const RECEIPT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    transaction_id: { type: Type.STRING, description: "UUID string or null" },
    vendor_name: { type: Type.STRING },
    date: { type: Type.STRING, description: "YYYY-MM-DD" },
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING },
          amount: { type: Type.NUMBER }
        }
      }
    },
    total_amount: { type: Type.NUMBER },
    category: { type: Type.STRING, enum: ["Fuel", "Maintenance", "Toll", "Salary", "Food", "Others"] },
    confidence: { type: Type.NUMBER }
  },
  required: ["vendor_name", "date", "total_amount", "category", "confidence"]
};

export async function extractReceiptData(base64Data: string, mimeType: string): Promise<ReceiptData> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
# ROLE
You are a High-Precision Data Extraction Engine specializing in Logistics and Financial Documents. Your goal is to convert unstructured input (images or text) into valid, minified JSON.

# CONTEXT
The data will be used for "Shekinah Movers," a trucking expense tracking system. Accuracy is critical for auditing and tax purposes.

# EXTRACTION RULES
1. **Currency**: Extract amounts as numbers only. Default currency is PHP unless stated.
2. **Dates**: Format all dates to ISO 8601 (YYYY-MM-DD).
3. **Categories**: Classify expenses into: [Fuel, Maintenance, Toll, Salary, Food, Others].
4. **Confidence Score**: Provide a score from 0.0 to 1.0 for each field.

# OUTPUT FORMAT (JSON ONLY)
Return ONLY a JSON object. Do not include markdown blocks like \`\`\`json ... \`\`\` or any conversational text.

{
  "transaction_id": "UUID string or null",
  "vendor_name": "string",
  "date": "YYYY-MM-DD",
  "items": [
    {"description": "string", "amount": 0.00}
  ],
  "total_amount": 0.00,
  "category": "string",
  "confidence": 0.00
}

# ERROR HANDLING
If the image is blurry or data is missing, return "null" for that specific field. Never hallucinate data.
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: RECEIPT_SCHEMA
      }
    });

    const resultText = response.text || '{}';
    const rawData = JSON.parse(resultText);

    // Map new simplified output format to the application's comprehensive ReceiptData type
    let mappedCategory = ExpenseCategory.OTHER;
    if (rawData.category) {
        const lowerCat = rawData.category.toLowerCase();
        if (lowerCat === 'fuel') mappedCategory = ExpenseCategory.FUEL;
        else if (lowerCat === 'maintenance') mappedCategory = ExpenseCategory.MAINTENANCE;
        else if (lowerCat === 'toll') mappedCategory = ExpenseCategory.TOLLS;
        else if (lowerCat === 'food') mappedCategory = ExpenseCategory.MEALS;
        else mappedCategory = ExpenseCategory.OTHER;
    }

    // Adapt to ReceiptData interface
    return {
        vendor_name: rawData.vendor_name || null,
        vendor_tin: null, // Field not present in new extraction rules
        vendor_branch: null, // Field not present in new extraction rules
        document_type: null, // Field not present in new extraction rules
        receipt_date: rawData.date || null,
        currency: 'PHP',
        subtotal: null,
        tax: null,
        total: rawData.total_amount || 0,
        payment_method: null,
        invoice_or_receipt_no: rawData.transaction_id && rawData.transaction_id !== 'null' ? rawData.transaction_id : null,
        line_items: Array.isArray(rawData.items) ? rawData.items.map((item: any) => ({
            description: item.description || 'Item',
            quantity: 1,
            unit_price: item.amount || 0,
            amount: item.amount || 0
        })) : [],
        suggested_category: mappedCategory,
        category_confidence: rawData.confidence || 0,
        notes: null
    };

  } catch (error) {
    console.error("Gemini Extraction Error:", error);
    throw error;
  }
}