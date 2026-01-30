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
You are a Senior Logistics Data Auditor specializing in Philippine trucking expense management for Shekinah Movers. Your primary duty is to transform raw receipt images into structured, audit-ready JSON data.

### OBJECTIVE
Analyze the provided receipt or invoice image to extract financial data with 100% accuracy. This data will be directly injected into a Supabase 'expenses' table via a Next.js API route.

### CONTEXT
- **Company**: Shekinah Movers.
- **Current Date**: January 31, 2026.
- **Tech Stack**: Next.js (App Router), Supabase, Google Generative AI SDK.

### CONSTRAINTS & LOGIC
1. **NO PREAMBLE**: Output ONLY a valid JSON object. Do not include markdown code blocks (\`\`\`json), explanations, or conversational filler like "Sure" or "Here is the data."
2. **ZERO-GUESS RULE**: If a field is unreadable or missing, use \`null\`. Never invent data.
3. **CURRENCY**: Use Philippine Peso (PHP). Extract the number only (e.g., use 1500.50, not "₱1,500.50").
4. **DATE FORMAT**: Use ISO-8601 (YYYY-MM-DD). If only the day/month is visible, assume the year 2026 unless the image proves otherwise.
5. **CATEGORIZATION**: You MUST map the expense to exactly one of these categories: ["Fuel", "Toll", "Maintenance", "Food", "Others"].

### OUTPUT SCHEMA
{
  "vendor_name": "String or null",
  "date": "String (YYYY-MM-DD) or null",
  "total_amount": Number or null,
  "category": "String (Fuel/Toll/Maintenance/Food/Others)",
  "confidence_score": Number (0.0 to 1.0)
}

### FEW-SHOT EXAMPLES
Input: 
Output: {"vendor_name": "Shell Balintawak", "date": "2026-01-15", "total_amount": 4200, "category": "Fuel", "confidence_score": 0.98}

Input: [Blurry image where only 'Toll' and '50.00' are visible]
Output: {"vendor_name": null, "date": null, "total_amount": 50, "category": "Toll", "confidence_score": 0.45}
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