import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import { Buffer } from 'buffer';

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Convert file to base64 for Gemini
    const arrayBuffer = await file.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = file.type;

    // Define System Instruction using the advanced prompt template
    const systemInstruction = `
### ROLE
You are an expert Logistics Accountant and Data Extraction Specialist for Shekinah Movers. Your communication style is professional, concise, and focused on data accuracy.

### CONTEXT
I am building a Trucking Expense Control SaaS. The specific feature is Receipt Ingestion & AI Extraction.
Current Tech Stack: Next.js, Supabase, Google GenAI SDK (Gemini 3 Flash Preview).

### OBJECTIVE
Your primary task is to extract receipt data from images and return strictly structured JSON for the database.

### TASK BREAKDOWN (CHAIN OF THOUGHT)
1. Step 1: Analyze the input image for vendor details, dates, and amounts.
2. Step 2: Validate if the document is a valid receipt (Official Receipt, Invoice, etc.).
3. Step 3: Transform the extracted text into the target JSON schema.
4. Step 4: Categorize the expense into allowed enums (e.g., "Diesel" -> 'Fuel').

### CONSTRAINTS & RULES
- DO NOT: Include conversational filler.
- DO NOT: Guess values. Use 'null' if data is missing.
- DO: Format all currency as numbers.
- DO: Use ISO-8601 for all date formats (YYYY-MM-DD).
- DO: Return strictly the JSON schema defined.

### EXAMPLES (FEW-SHOT)
Input: [Image of Petron receipt, 2000 PHP, Diesel, 2024-05-20]
Output: { "vendor_name": "Petron", "total_amount": 2000, "category": "Fuel", "date": "2024-05-20", "confidence_score": 0.99 }
`;

    // Prompt Gemini using gemini-3-flash-preview
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
            text: "Extract the data according to the system instructions."
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
            date: { type: Type.STRING, description: "Format YYYY-MM-DD", nullable: true },
            total_amount: { type: Type.NUMBER, nullable: true },
            category: { 
              type: Type.STRING, 
              enum: ["Fuel", "Toll", "Maintenance", "Food", "Others"],
              nullable: true
            },
            confidence_score: { type: Type.NUMBER, description: "Value between 0 and 1", nullable: true }
          }
        }
      }
    });

    const text = response.text || '{}';
    const extractedData = JSON.parse(text);

    // Insert into Supabase
    const { data, error } = await supabase
      .from('expenses')
      .insert([
        {
          vendor_name: extractedData.vendor_name,
          expense_date: extractedData.date,
          amount: extractedData.total_amount,
          category: extractedData.category?.toLowerCase() || 'other',
          confidence: extractedData.confidence_score,
          receipt_url: 'pending_storage_upload', 
          created_at: new Date().toISOString()
        }
      ])
      .select();

    if (error) {
      console.error('Supabase Error:', error);
      return NextResponse.json({ error: 'Database insertion failed', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      data: extractedData,
      db_record: data 
    }, { status: 200 });

  } catch (error: any) {
    console.error('Processing Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}