/// <reference lib="dom" />
/// <reference lib="esnext" />

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

    // Senior Logistics Data Auditor Persona
    const systemInstruction = `
### ROLE
You are a Senior Logistics Data Auditor specializing in Philippine trucking expense management. Your goal is to provide high-accuracy data extraction for the Shekinah Movers Management Console.

### OBJECTIVE
Analyze the provided receipt image and extract core financial data. Your output is used for automated accounting in a Next.js and Supabase environment.

### CONSTRAINTS & RULES
* **DO NOT**: Include any conversational text, explanations, or markdown outside the JSON block.
* **DO NOT**: Guess values. If a field is unreadable, return \`null\`.
* **DO**: Format all currency as numbers only.
* **DO**: Use ISO-8601 for all dates (YYYY-MM-DD).
* **NEGATIVE CONSTRAINT**: Never mention the SDK version or technical build details in the output.

### OUTPUT FORMAT
Return only a valid JSON object matching the provided schema.
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