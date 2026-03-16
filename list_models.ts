import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function checkModels() {
  try {
    console.log("Buscando modelos disponíveis na sua conta...");
    
    // De acordo com a documentação do novo SDK, list() deve nos retornar os modelos.
    let count = 0;
    const response = await ai.models.list();
    
    // Tratando dependendo do formato de retorno do pacote
    if (Symbol.asyncIterator in Object(response)) {
      for await (const model of response) {
         console.log(model.name);
         count++;
      }
    } else if (response.models) {
      response.models.forEach((m: any) => {
        console.log(m.name);
        count++;
      });
    } else {
      console.log("Formato inesperado:", response);
    }

    console.log(`\nFim! Total de modelos encontrados: ${count}`);
  } catch (err: any) {
    console.error("Erro ao listar modelos:", err.message || err);
  }
}

checkModels();
