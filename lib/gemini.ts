/// <reference lib="dom" />
/// <reference lib="esnext" />

import { GoogleGenAI, Type } from "@google/genai";
import { ReceiptData, ExpenseCategory } from "../types";

// Initialize the API client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function extractReceiptData(base64Data: string, mimeType: string): Promise<ReceiptData> {
  // Senior Logistics Data Auditor Persona
  const systemInstruction = `
### ROLE
You are a Senior Logistics Data Auditor specializing in Philippine trucking expense management for Shekinah Movers.

### OBJECTIVE
Extract structured data from receipt and invoice images with 100% accuracy for a client presentation.

### CONSTRAINTS & RULES
* **NO PREAMBLE**: Return ONLY a valid JSON object. Do not include markdown code blocks or explanations.
* **ZERO-GUESS RULE**: Use 'null' if a field is unreadable or missing.
* **CURRENCY**: Use Philippine Peso (PHP). Format amounts as numbers only (e.g., 4200.50).
* **DATE FORMAT**: Use ISO-8601 (YYYY-MM-DD).
* **ENUM CATEGORIES**: You MUST categorize the expense as exactly one of these: ["Fuel", "Toll", "Maintenance", "Food", "Others"].

### OUTPUT SCHEMA
{
  "vendor_name": "String or null",
  "date": "String (YYYY-MM-DD) or null",
  "total_amount": Number or null,
  "category": "String (Fuel | Toll | Maintenance | Food | Others)",
  "confidence_score": Number (0.0 to 1.0)
}

### EXAMPLES (FEW-SHOT)
Input: Output: {"vendor_name": "Petron Cabuyao", "date": "2026-01-30", "total_amount": 3500, "category": "Fuel", "confidence_score": 0.99}
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
            enum: ["Fuel", "Toll", "Maintenance", "Food", "Others"]
          },
          confidence_score: { type: Type.NUMBER, nullable: true }
        }
      }
    }
  });

  const text = response.text;

  if (!text) {
    throw new Error("No data returned from Gemini.");
  }

  const raw = JSON.parse(text);

  // Helper to map AI categories to internal ExpenseCategory enum
  const mapCategory = (cat: string | null): ExpenseCategory | null => {
    if (!cat) return null;
    const lower = cat.toLowerCase();
    switch (lower) {
      case 'fuel': return ExpenseCategory.FUEL;
      case 'toll': return ExpenseCategory.TOLLS;
      case 'maintenance': return ExpenseCategory.MAINTENANCE;
      case 'food': return ExpenseCategory.MEALS;
      case 'others': return ExpenseCategory.OTHER;
      default: return ExpenseCategory.OTHER;
    }
  };

  // Map the strict AI output to the robust ReceiptData type expected by the App
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
    suggested_category: mapCategory(raw.category),
    category_confidence: raw.confidence_score || 0,
    notes: null
  };

  return result;
}