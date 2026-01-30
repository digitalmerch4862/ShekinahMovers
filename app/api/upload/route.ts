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
            date: { type: Type.STRING, nullable: true },
            total_amount: { type: Type.NUMBER, nullable: true },
            category: { 
              type: Type.STRING, 
              enum: ["Fuel", "Toll", "Maintenance", "Food", "Others"],
              nullable: true
            },
            confidence_score: { type: Type.NUMBER, nullable: true }
          }
        }
      }
    });

    const text = response.text || '{}';
    const extractedData = JSON.parse(text);

    // Map categories to DB enum
    const mapCategoryToDb = (cat: string | null): string => {
        if (!cat) return 'other';
        const lower = cat.toLowerCase();
        if (lower === 'toll') return 'tolls';
        if (lower === 'food') return 'meals';
        if (lower === 'others') return 'other';
        return lower;
    };

    // Insert into Supabase
    const { data, error } = await supabase
      .from('expenses')
      .insert([
        {
          vendor_name: extractedData.vendor_name,
          expense_date: extractedData.date,
          amount: extractedData.total_amount,
          category: mapCategoryToDb(extractedData.category),
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