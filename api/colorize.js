export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(455).json({ error: 'Metodo non consentito. Usa POST.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ 
      error: 'Chiave GEMINI_API_KEY non configurata nelle Environment Variables di Vercel.' 
    });
  }

  try {
    const { imageBase64, mimeType, mood, customPrompt } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Nessuna immagine fornita.' });
    }

    const moodDescriptions = {
      pastello: 'stile pastello kawaii morbido, colori latte, lilla chiaro, rosa pesca, celeste baby, giallo burro chiaro, menta chiarissimo',
      autunno: 'stile autunno caldo e accogliente, toni zucca, ocra, cannella, ruggine, miele e legno scuro',
      magico: 'stile notte fiabesca e magica, sfumature indaco scuro, viola profondo, accenti ciano e verde menta fluo magico',
      natura: 'stile bosco incantato, verde salvia, oliva tenue, muschio, accenti panna e marrone caldo'
    };

    const selectedStyle = moodDescriptions[mood] || moodDescriptions.pastello;
    const extraDetails = customPrompt ? ` Richieste specifiche dell'utente: ${customPrompt}.` : '';

    const promptText = `Questa è una pagina da colorare in bianco e nero (line art). 
Ricolorala completamente con campiture pulite nello ${selectedStyle}.${extraDetails}
IMPORTANTE: Mantieni nitidi, precisi e inalterati tutti i contorni neri originali del disegno. Applica colori armoniosi, vibranti e ben sfumati come se fosse colorata con pennarelli professionali ad alcool.`;

    const pureBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

    // Chiamata all'endpoint Google Generative AI
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: promptText },
              {
                inline_data: {
                  mime_type: mimeType || 'image/jpeg',
                  data: pureBase64
                }
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ 
        error: err?.error?.message || `Errore Google API: HTTP ${response.status}` 
      });
    }

    const data = await response.json();

    let coloredImage = null;
    let explanation = '';

    const candidate = data?.candidates?.[0];
    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.inline_data && part.inline_data.data) {
          coloredImage = `data:${part.inline_data.mime_type || 'image/png'};base64,${part.inline_data.data}`;
        }
        if (part.text) {
          explanation += part.text;
        }
      }
    }

    // Se il modello ha restituito l'immagine binaria
    if (coloredImage) {
      return res.status(200).json({
        success: true,
        coloredImage: coloredImage,
        explanation: explanation
      });
    }

    return res.status(200).json({
      success: true,
      coloredImage: null,
      explanation: explanation || 'Colorazione completata.'
    });

  } catch (error) {
    console.error('Serverless Error:', error);
    return res.status(500).json({ error: error.message || 'Errore interno del server.' });
  }
}
