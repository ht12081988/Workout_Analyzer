import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// Initialize the Gemini SDK
// It defaults to using process.env.GEMINI_API_KEY, but we will explicitly pass the one provided by the user.
const ai = new GoogleGenAI({ apiKey: process.env.Workout_Generator_Key || process.env.GEMINI_API_KEY });

export async function POST(req: Request) {
  try {
    const { exerciseName, category } = await req.json();

    if (!exerciseName) {
      return NextResponse.json({ error: "Exercise name is required" }, { status: 400 });
    }

    // Dynamically fetch bounds from the Metrics Master to guarantee perfect alignment
    let metricRules = "";
    try {
      const metricsRes = await fetch('http://127.0.0.1:5002/metrics');
      if (metricsRes.ok) {
        const metricsData = await metricsRes.json();
        metricRules = metricsData.map((m: any) => 
          `   - ${m.metric_key}: ${m.min_val} to ${m.max_val} (${m.description || m.metric_name})`
        ).join('\n');
      }
    } catch (e) {
      console.warn("Could not fetch master_metrics, falling back to minimal prompt rules.");
    }

    const prompt = `
You are an expert biomechanics engineer and personal trainer configuring a 3D AI computer vision system.
You need to generate the configuration for the exercise: "${exerciseName}" (Category: "${category}").

You must respond with ONLY a raw JSON object (no markdown, no backticks, no markdown blocks).
The JSON object must have this exact structure:
{
  "phases": [
    {
      "id": "1", // string
      "label": "ONE OF: 'Setup', 'First Movement', 'Hold / Pause', 'Top', 'Return Movement'",
      "isSetupPhase": boolean,
      "entryConditions": [
        {
          "metric": "ONE_OF_THE_METRICS",
          "operator": ">" | "<" | "==" | ">=" | "<=",
          "value": number,
          "isBlocking": true
        }
      ],
      "formChecks": [
        {
          "metric": "ONE_OF_THE_METRICS",
          "operator": ">" | "<",
          "value": number,
          "message": "String warning message to the user if form is broken."
        }
      ]
    }
  ]
}

Rules:
1. Available metrics and their STRICT value bounds (min to max):
${metricRules}
2. DO NOT use any metric not in that list.
3. YOUR VALUES MUST FALL STRICTLY WITHIN THE MIN/MAX RANGES OUTLINED ABOVE.
4. Generate 2 to 4 phases maximum (e.g., Setup, Down, Up).
5. CRITICAL LOGIC FOR OPERATORS: 
   - If a phase requires a joint to flex or drop (the metric value is decreasing, e.g., dropping into a squat where angle goes from 180 to 90), the entryCondition operator MUST be "<" (e.g., metric < 160).
   - If a phase requires a joint to extend or rise (the metric value is increasing, e.g., standing up from a squat), the entryCondition operator MUST be ">" (e.g., metric > 100).
   - Think step-by-step about the direction the body is moving before picking ">" or "<".
6. SETUP PHASE LOGIC:
   - The phase marked "isSetupPhase": true MUST represent the static starting position of the exercise where the primary working joints are fully extended or in their neutral resting state.
   - Its entryCondition should check that the user is in this full starting extension (e.g., > 160 for a standing or straight-arm start).
7. FORM CHECKS LOGIC:
   - Form checks trigger an error message when their condition evaluates to TRUE. Therefore, the operator MUST define the ERROR state, not the good state.
   - Example: If the goal is "Keep torso upright" (where upright is 0 degrees and bent over is 90 degrees), the error state is leaning forward. The operator MUST be ">" (e.g., metric > 15).
   - Example: If the goal is "Keep arms straight" (where 180 is straight), the error state is bending. The operator MUST be "<" (e.g., metric < 160).
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = response.text || "{}";
    const configData = JSON.parse(text);

    return NextResponse.json(configData);
  } catch (error: any) {
    console.error("AI Generation Error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate AI blueprint" }, { status: 500 });
  }
}
