import { GoogleGenAI, Type } from "@google/genai";
import { ReceiptData } from "../types";

// Initialize the API client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function extractReceiptData(base64Data: string, mimeType: string): Promise<ReceiptData> {
  // Enhanced System Instruction based on the user's template
  const systemInstruction = `
### ROLE
You are an expert Logistics Accountant and Data Extraction Specialist for "Shekinah Movers", a trucking company.

### TASK
Your objective is to accurately extract expense data from receipt images into a structured JSON format for fleet operations tracking.

### INPUT DATA
User will provide an image of a receipt (Fuel, Toll, Maintenance, Parts, Food, etc.).

### CONSTRAINTS & LOGIC
1. **Accuracy**: Ensure vendor names, dates (YYYY-MM-DD), and numeric amounts are exact.
2. **Categorization**: Analyze line items to select the best enum value:
   - 'fuel' for Diesel/Gasoline/AdBlue.
   - 'tolls' for RFID load or expressway receipts.
   - 'maintenance' for mechanic services, car wash, or repairs.
   - 'parts' for spare parts or tires.
   - 'meals' for driver food allowances.
3. **Context**: The company operates in the Philippines; currency is predominantly PHP.
4. **Formatting**: Return strict JSON matching the requested schema. If a field is illegible, return null.
`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        },
        {
          text: "Analyze this receipt image and extract the data."
        }
      ]
    },
    config: {
      systemInstruction: systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          vendor_name: { type: Type.STRING, nullable: true },
          vendor_tin: { type: Type.STRING, nullable: true },
          vendor_branch: { type: Type.STRING, nullable: true },
          document_type: { 
            type: Type.STRING, 
            nullable: true,
            enum: ['Official Receipt', 'Sales Invoice', 'Billing Statement', 'Other']
          },
          receipt_date: { type: Type.STRING, nullable: true },
          currency: { type: Type.STRING, nullable: true },
          subtotal: { type: Type.NUMBER, nullable: true },
          tax: { type: Type.NUMBER, nullable: true },
          total: { type: Type.NUMBER, nullable: true },
          payment_method: { type: Type.STRING, nullable: true },
          invoice_or_receipt_no: { type: Type.STRING, nullable: true },
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
            },
            nullable: true
          },
          suggested_category: { 
            type: Type.STRING, 
            nullable: true,
            enum: [
              'fuel', 'tolls', 'maintenance', 'tires', 'parts', 'parking', 'meals', 'lodging',
              'supplies', 'insurance', 'permits', 'fees', 'phone_internet', 'office', 'other'
            ]
          },
          category_confidence: { type: Type.NUMBER, nullable: true },
          notes: { type: Type.STRING, nullable: true }
        }
      }
    }
  });

  const text = response.text;

  if (!text) {
    throw new Error("No data returned from Gemini.");
  }

  return JSON.parse(text) as ReceiptData;
}