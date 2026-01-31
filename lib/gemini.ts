
import { GoogleGenAI, Type } from "@google/genai";
import { ReceiptData, ExpenseCategory } from "../types";

const RECEIPT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    vendor_name: { type: Type.STRING },
    vendor_tin: { type: Type.STRING, description: "Tax Identification Number of the merchant if available." },
    vendor_branch: { type: Type.STRING, description: "The specific branch location of the merchant." },
    document_type: { 
      type: Type.STRING, 
      description: "Classification: Official Receipt, Sales Invoice, Billing Statement, or Other." 
    },
    receipt_date: { type: Type.STRING },
    currency: { type: Type.STRING },
    subtotal: { type: Type.NUMBER },
    tax: { type: Type.NUMBER },
    total: { type: Type.NUMBER },
    payment_method: { type: Type.STRING },
    invoice_or_receipt_no: { type: Type.STRING },
    line_items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING },
          quantity: { type: Type.NUMBER },
          unit_price: { type: Type.NUMBER },
          amount: { type: Type.NUMBER }
        }
      }
    },
    suggested_category: { type: Type.STRING },
    category_confidence: { type: Type.NUMBER },
    notes: { type: Type.STRING }
  },
  required: ["total", "suggested_category", "vendor_name", "receipt_date"]
};

// Fixed extractReceiptData: moved instantiation inside and corrected contents structure
export async function extractReceiptData(base64Data: string, mimeType: string): Promise<ReceiptData> {
  // Always use the API key from process.env.API_KEY directly as per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `You are an advanced accounting audit engine for a logistics firm.
Extract the merchant's full name, TIN (Tax ID), branch, and classification.
Classification MUST be one of: 'Official Receipt', 'Sales Invoice', 'Billing Statement', or 'Other'.
Return STRICT VALID JSON ONLY. No markdown. No commentary.
If a field is missing, use null. Dates YYYY-MM-DD. Currency default PHP.
Calculate tax breakdown if not explicitly stated (assume 12% VAT in Philippines context if applicable).
Amounts must be numeric. Provide line_items as visible on the receipt.
Guess suggested_category from: fuel, tolls, maintenance, tires, parts, parking, meals, lodging, supplies, insurance, permits, fees, phone_internet, office, other.`;

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
    return JSON.parse(resultText) as ReceiptData;
  } catch (error) {
    console.error("Gemini Extraction Error:", error);
    throw error;
  }
}
