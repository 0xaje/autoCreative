/**
 * Section 4: AI Layer & Provider Abstraction
 */

class AIProvider {
  /**
   * Generate free-form natural language text
   */
  async generateText(input) {
    throw new Error('generateText must be implemented by subclass');
  }

  /**
   * Generate typed structured object conforming to JSONSchema
   */
  async generateStructured(input, schema) {
    throw new Error('generateStructured must be implemented by subclass');
  }
}

class GeminiFlashProvider extends AIProvider {
  constructor(apiKey = process.env.GEMINI_API_KEY) {
    super();
    this.apiKey = apiKey;
    this.modelName = 'gemini-2.5-flash';
  }

  isAvailable() {
    return Boolean(this.apiKey);
  }

  async generateText(input) {
    const prompt = typeof input === 'string' ? input : input.prompt;
    if (!this.apiKey) {
      return {
        text: `Deterministic studio narrative for: ${prompt.slice(0, 100)}...`,
        model: 'deterministic-fallback'
      };
    }

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return { text, model: this.modelName };
    } catch (e) {
      console.warn('Gemini API call failed, falling back to deterministic generation:', e.message);
      return { text: `Product narrative for: ${prompt}`, model: 'deterministic-fallback' };
    }
  }

  async generateStructured(input, schema) {
    const prompt = typeof input === 'string' ? input : input.prompt;
    const structuredPrompt = `${prompt}\n\nRespond ONLY with valid JSON conforming to this schema:\n${JSON.stringify(schema, null, 2)}`;
    const result = await this.generateText(structuredPrompt);

    try {
      const cleanJson = result.text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleanJson);
    } catch (e) {
      return schema.default || {};
    }
  }
}

class DeterministicAIProvider extends AIProvider {
  isAvailable() {
    return false; // Deterministic rule-based fallback, not an LLM provider
  }

  async generateText(input) {
    const prompt = typeof input === 'string' ? input : input.prompt;
    return {
      text: `Deterministic studio production for: ${prompt}`,
      model: 'deterministic-engine'
    };
  }

  async generateStructured(input, schema) {
    return schema.default || {};
  }
}

function getAIProvider(preferred) {
  if (preferred === 'deterministic') {
    return new DeterministicAIProvider();
  }
  if (process.env.GEMINI_API_KEY) {
    return new GeminiFlashProvider(process.env.GEMINI_API_KEY);
  }
  return new DeterministicAIProvider();
}

module.exports = {
  AIProvider,
  GeminiFlashProvider,
  DeterministicAIProvider,
  getAIProvider
};
