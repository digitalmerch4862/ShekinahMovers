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

    // Define System Instruction for consistent logic
    const systemInstruction = `
### ROLE
You are an expert Logistics Accountant for Shekinah Movers.

### TASK
Extract accurate expense data from receipt images for the database.

### CONSTRAINTS & LOGIC
1. Identify the Vendor, Date, and Total Amount strictly.
2. Categorize the expense into one of the allowed enum values: ["Fuel", "Toll", "Maintenance", "Food", "Others"].
   - "Fuel": Diesel, Gasoline.
   - "Toll": RFID, Expressway fees.
   - "Maintenance": Repairs, Parts, Tires, Mechanic.
   - "Food": Driver meals.
3. Calculate a confidence score (0-1) based on legibility and completeness.
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