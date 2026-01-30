/// <reference lib="dom" />
/// <reference lib="esnext" />

import { GoogleGenAI, Type } from "@google/genai";
import { ReceiptData, ExpenseCategory } from "../types";

// Initialize the API client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function extractReceiptData(base64Data: string, mimeType: string): Promise<ReceiptData> {
  // Senior Logistics Auditor Persona for POC
  const systemInstruction = `
### ROLE
You are a Senior Logistics Auditor for Shekinah Movers. Your goal is to showcase "Receipt Intelligence" to potential clients.

### CONTEXT
We are presenting a Proof of Concept (POC) for a trucking expense SaaS. The extraction must be fast, accurate, and professional.

### CONSTRAINTS
- **OUTPUT**: Return ONLY raw JSON. No markdown, no chat.
- **LOGIC**: 
  - If the receipt is from a gas station, category is "Fuel".
  - If it is for food/meals, category is "Food".
  - If it is for parts or repairs, category is "Maintenance".
- **CURRENCY**: Convert all amounts to numbers (PHP).

### DATA SCHEMA
{
  "vendor_name": "Name of the shop/station",
  "date": "YYYY-MM-DD",
  "total_amount": 0.00,
  "category": "Fuel | Maintenance | Food | Tolls | Others",
  "confidence": 0.95
}
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
          date: { type: Type.STRING, nullable: true },
          total_amount: { type: Type.NUMBER, nullable: true },
          category: { 
            type: Type.STRING, 
            nullable: true,
            enum: ["Fuel", "Maintenance", "Food", "Tolls", "Others"]
          },
          confidence: { type: Type.NUMBER, nullable: true }
        }
      }
    }
  });

  const text = response.text;

  if (!text) {
    throw new Error("No data returned from Gemini.");
  }

  const raw = JSON.parse(text);

  // Map the POC AI output to the robust ReceiptData type expected by the App
  const result: ReceiptData = {
    vendor_name: raw.vendor_name,
    vendor_tin: null,
    vendor_branch: null,
    document_type: null,
    receipt_date: raw.date,
    currency: 'PHP',
    subtotal: null,
    tax: null,
    total: raw.total_amount,
    payment_method: null,
    invoice_or_receipt_no: null,
    line_items: [],
    // Safely cast or map the category. The AI returns Capitalized, App expects lowercase enum.
    suggested_category: raw.category ? raw.category.toLowerCase() as ExpenseCategory : null,
    category_confidence: raw.confidence || 0,
    notes: null
  };

  return result;
}