/// <reference lib="dom" />
/// <reference lib="esnext" />

import { GoogleGenAI, Type } from "@google/genai";
import { ReceiptData } from "../types";

// Initialize the API client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function extractReceiptData(base64Data: string, mimeType: string): Promise<ReceiptData> {
  // Senior Logistics Data Auditor Persona
  const systemInstruction = `
### ROLE
You are a Senior Logistics Data Auditor specializing in Philippine trucking expense management. Your goal is to provide high-accuracy data extraction for the Shekinah Movers Management Console.

### OBJECTIVE
Analyze the provided receipt image and extract core financial data. Your output is used for automated accounting in a Next.js and Supabase environment.

### CONSTRAINTS & RULES
* **DO NOT**: Include any conversational text, explanations, or markdown outside the JSON block.
* **DO NOT**: Guess values. If a field is unreadable, return \`null\`.
* **DO**: Format all currency as numbers only (e.g., 4200 instead of ₱4,200).
* **DO**: Use ISO-8601 for all dates (YYYY-MM-DD).
* **NEGATIVE CONSTRAINT**: Never mention the SDK version or technical build details in the output.

### OUTPUT FORMAT
Return only a valid JSON object matching the provided schema.
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