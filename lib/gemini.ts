import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { ReceiptData, ExpenseCategory } from "../types";

export async function extractReceiptData(base64Data: string, mimeType: string): Promise<ReceiptData> {
  const genAI = new GoogleGenerativeAI(process.env.API_KEY || '');
  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          vendor_name: { type: SchemaType.STRING, nullable: true },
          vendor_tin: { type: SchemaType.STRING, nullable: true },
          vendor_branch: { type: SchemaType.STRING, nullable: true },
          document_type: { type: SchemaType.STRING, nullable: true },
          receipt_date: { type: SchemaType.STRING, nullable: true },
          currency: { type: SchemaType.STRING, nullable: true },
          subtotal: { type: SchemaType.NUMBER, nullable: true },
          tax: { type: SchemaType.NUMBER, nullable: true },
          total: { type: SchemaType.NUMBER, nullable: true },
          payment_method: { type: SchemaType.STRING, nullable: true },
          invoice_or_receipt_no: { type: SchemaType.STRING, nullable: true },
          line_items: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                description: { type: SchemaType.STRING },
                quantity: { type: SchemaType.NUMBER },
                unit_price: { type: SchemaType.NUMBER },
                amount: { type: SchemaType.NUMBER }
              }
            }
          },
          suggested_category: { type: SchemaType.STRING, nullable: true },
          category_confidence: { type: SchemaType.NUMBER },
          notes: { type: SchemaType.STRING, nullable: true }
        }
      }
    }
  });

  const prompt = "Analyze this receipt image. Extract all visible data into the specified JSON format. Ensure the suggested_category matches one of: fuel, tolls, maintenance, tires, parts, parking, meals, lodging, supplies, insurance, permits, fees, phone_internet, office, other.";

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        data: base64Data,
        mimeType: mimeType
      }
    }
  ]);

  const response = result.response;
  const text = response.text();
  
  if (!text) {
    throw new Error("No data returned from Gemini.");
  }

  return JSON.parse(text) as ReceiptData;
}