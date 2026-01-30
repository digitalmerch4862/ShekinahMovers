import { GoogleGenAI, Type } from "@google/genai";
import { ReceiptData } from "../types";

// Initialize the API client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function extractReceiptData(base64Data: string, mimeType: string): Promise<ReceiptData> {
  // Use Gemini 3 Flash Preview for basic text/extraction tasks
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
          text: "Analyze this receipt image and extract the data into a JSON object."
        }
      ]
    },
    config: {
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