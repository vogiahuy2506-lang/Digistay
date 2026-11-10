import { GenerateContentInput, GenerateContentOutput, ContentLocalizedOutput, AiTone } from './types'

const TONE_DESCRIPTIONS_VI: Record<AiTone, string> = {
  LUXURY: 'Sang trọng, đẳng cấp, tinh tế, ngôn từ chọn lọc',
  COZY: 'Ấm cúng, mộc mạc, gần gũi như ở nhà, thư giãn tối đa',
  MODERN: 'Hiện đại, tiện nghi công nghệ, trẻ trung và thanh lịch',
  ROMANTIC: 'Lãng mạn, ngọt ngào, riêng tư, dành cho các cặp đôi',
  FAMILY: 'Rộng rãi, ấm áp, tiện lợi và an toàn cho gia đình',
}

const TONE_DESCRIPTIONS_EN: Record<AiTone, string> = {
  LUXURY: 'Luxury, sophisticated, bespoke and upscale tone',
  COZY: 'Cozy, warm, home-like and serene atmosphere',
  MODERN: 'Modern, sleek, tech-friendly and chic style',
  ROMANTIC: 'Romantic, intimate, dreamy for couples',
  FAMILY: 'Spacious, kid-friendly, welcoming and convenient for families',
}

/**
 * Heuristic generator when external AI API keys are not provided or during offline test runs.
 * Synthesizes high-converting, human-like hospitality copy adhering to CRO & Copywriting best practices.
 */
export function generateHeuristicContent(input: GenerateContentInput): GenerateContentOutput {
  const isRoom = input.contentType === 'ROOM_DESCRIPTION'
  const tone = input.tone || 'COZY'
  const lang = input.language || 'bilingual'
  const propName = input.propertyName || 'Digistay Hotel & Resort'

  const rawKeywords = input.keywords
    ? input.keywords.split(/[,;\n]+/).map((k) => k.trim()).filter(Boolean)
    : []
  const keywordListVi = rawKeywords.length > 0 ? rawKeywords.join(', ') : 'tiện nghi hiện đại, không gian thoáng đãng'
  const keywordListEn = rawKeywords.length > 0 ? rawKeywords.join(', ') : 'modern amenities, scenic view, relaxing atmosphere'

  const roomTitleVi = input.roomName || (rawKeywords[0] ? `Phòng ${rawKeywords[0]}` : 'Phòng Nghỉ Tiêu Chuẩn')
  const roomTitleEn = input.roomName
    ? `${input.roomName} Room`
    : rawKeywords[0]
      ? `${rawKeywords[0].charAt(0).toUpperCase() + rawKeywords[0].slice(1)} Room`
      : 'Standard Guest Room'

  const blogTitleVi = input.topic || (input.roomName ? `Khám phá trải nghiệm nghỉ dưỡng tại ${input.roomName}` : 'Cẩm nang du lịch & kỳ nghỉ trọn vẹn')
  const blogTitleEn = input.topic || (input.roomName ? `Discover the ultimate stay in ${input.roomName}` : 'Your Essential Travel & Stay Guide')

  const titleVi = isRoom ? roomTitleVi : blogTitleVi
  const titleEn = isRoom ? roomTitleEn : blogTitleEn

  // Vietnamese copy
  const areaPartVi = input.area ? ` với diện tích rộng rãi ${input.area}m²` : ''
  const bedPartVi = input.bedType ? `, trang bị giường ${input.bedType.toLowerCase()}` : ''

  const shortDescVi = isRoom
    ? `Tận hưởng kỳ nghỉ thư thái tại ${titleVi}${areaPartVi}${bedPartVi}. Không gian được thiết kế theo phong cách ${TONE_DESCRIPTIONS_VI[tone].toLowerCase()}, mang lại sự yên bình và tái tạo năng lượng.`
    : `Khám phá những trải nghiệm đặc sắc và tiện nghi chuẩn mực tại ${propName}, nơi từng khoảnh khắc đều được chăm chút trọn vẹn.`

  // Image markdown helpers
  const images = input.images || []
  const img1Vi = images[0] ? `\n\n![${images[0].caption || titleVi}](${images[0].url})\n*${images[0].caption || `Không gian tuyệt đẹp tại ${propName}`}*\n\n` : '\n\n'
  const img2Vi = images[1] ? `\n\n![${images[1].caption || 'Chi tiết tiện nghi & không gian'}](${images[1].url})\n*${images[1].caption || 'Góc thư giãn thanh lịch, tràn ngập ánh sáng tự nhiên'}*\n\n` : '\n\n'
  const img3Vi = images[2] ? `\n\n![${images[2].caption || 'Trải nghiệm trọn vẹn'}](${images[2].url})\n*${images[2].caption || 'Tận hưởng từng khoảnh khắc đáng nhớ trong kỳ nghỉ'}*\n\n` : ''

  const fullDescVi = isRoom
    ? `## Trải Nghiệm Nghỉ Dưỡng Tại ${titleVi}
${img1Vi}Chào đón bạn đến với không gian nghỉ dưỡng lý tưởng tại **${propName}**. ${titleVi} được thiết kế hài hòa giữa nét thẩm mỹ hiện đại và cảm giác ấm cúng thân thuộc.

### Điểm Nhấn Không Gian & Tiện Nghi
- **Không gian tối ưu**: Diện tích${areaPartVi || ' thoáng đãng'} ngập tràn ánh sáng tự nhiên.
- **Giấc ngủ êm ái**: Nệm cao cấp cùng bộ chăn ga tiêu chuẩn khách sạn giúp bạn có giấc ngủ sâu trọn vẹn.
- **Tiện nghi nổi bật**: ${keywordListVi}.
- **Phòng tắm thư giãn**: Trang bị vòi sen áp lực cao cùng bộ đồ dùng vệ sinh hữu cơ cao cấp.
${img2Vi}### Dành Cho Kỳ Nghỉ Của Bạn
Cho dù bạn đang tìm kiếm chốn dừng chân sau ngày dài khám phá hay không gian riêng tư cho chuyến công tác, ${titleVi} sẽ là điểm tựa hoàn hảo cho mọi hành trình.${img3Vi}`
    : `## ${titleVi}
${img1Vi}Một kỳ nghỉ đáng nhớ không chỉ nằm ở điểm đến, mà còn là cảm giác được chăm sóc chu đáo trong từng chi tiết. Tại **${propName}**, chúng tôi kiến tạo không gian sống dung hòa giữa sự tiện nghi và sự bình yên.

### Những Trải Nghiệm Không Thể Bỏ Lỡ
- **Ẩm thực bản địa tinh tế**: Thưởng thức các món ngon được chế biến từ nguyên liệu tươi ngon nhất.
- **Không gian thư giãn**: Hòa mình vào thiên nhiên và tận hưởng những phút giây thảnh thơi.
- **Tiện ích đa dạng**: ${keywordListVi}.
${img2Vi}Hãy để chuyến đi của bạn trở thành kỷ niệm khó quên với sự đồng hành ấm áp từ đội ngũ chúng tôi.${img3Vi}`

  const metaTitleVi = `${titleVi} | ${propName}`.slice(0, 60)
  const metaDescVi = shortDescVi.slice(0, 155)

  // English copy
  const areaPartEn = input.area ? ` spanning a spacious ${input.area}m²` : ''
  const bedPartEn = input.bedType ? `, featuring a premium ${input.bedType.toLowerCase()} bed` : ''

  const shortDescEn = isRoom
    ? `Experience peaceful relaxation in our ${titleEn}${areaPartEn}${bedPartEn}. Thoughtfully styled with a ${TONE_DESCRIPTIONS_EN[tone].toLowerCase()} vibe for an unforgettable stay.`
    : `Discover signature hospitality, comfort, and local charms at ${propName}, where every moment is thoughtfully curated.`

  const img1En = images[0] ? `\n\n![${images[0].caption || titleEn}](${images[0].url})\n*${images[0].caption || `Captivating ambiance at ${propName}`}*\n\n` : '\n\n'
  const img2En = images[1] ? `\n\n![${images[1].caption || 'Refined living space'}](${images[1].url})\n*${images[1].caption || 'Elegantly curated spaces with comforting natural light'}*\n\n` : '\n\n'
  const img3En = images[2] ? `\n\n![${images[2].caption || 'Unforgettable stay'}](${images[2].url})\n*${images[2].caption || 'Cherish every relaxing moment of your getaway'}*\n\n` : ''

  const fullDescEn = isRoom
    ? `## Welcome to ${titleEn}
${img1En}Discover pure comfort at **${propName}**. The ${titleEn} seamlessly blends contemporary aesthetics with the soothing warmth of authentic hospitality.

### Key Features & Amenities
- **Refined Living Space**: Thoughtfully arranged${areaPartEn || ' generous layout'} with natural light.
- **Restful Sleep**: Plush hotel-grade mattress and crisp linens ensuring a rejuvenating night.
- **Highlighted Features**: ${keywordListEn}.
- **Rejuvenating Bath**: High-pressure rain shower paired with organic bath amenities.
${img2En}### Perfect For Your Getaway
Whether you are visiting for a relaxing weekend retreat or a productive business trip, ${titleEn} offers the sanctuary you need.${img3En}`
    : `## ${titleEn}
${img1En}A memorable vacation is defined by the details that make you feel truly cared for. At **${propName}**, we offer the ideal balance between modern convenience and mindful tranquility.

### What Awaits You
- **Authentic Culinary Flavors**: Savor delightful dishes made with fresh seasonal ingredients.
- **Serene Environment**: Unwind in a calm sanctuary away from daily rush.
- **Comfort & Highlights**: ${keywordListEn}.
${img2En}Let us make your stay extraordinary from the moment you step through our doors.${img3En}`

  const metaTitleEn = `${titleEn} | ${propName}`.slice(0, 60)
  const metaDescEn = shortDescEn.slice(0, 155)

  const viOutput: ContentLocalizedOutput = {
    title: titleVi,
    shortDescription: shortDescVi,
    fullDescription: fullDescVi,
    metaTitle: metaTitleVi,
    metaDescription: metaDescVi,
  }

  const enOutput: ContentLocalizedOutput = {
    title: titleEn,
    shortDescription: shortDescEn,
    fullDescription: fullDescEn,
    metaTitle: metaTitleEn,
    metaDescription: metaDescEn,
  }

  return {
    ...viOutput,
    ...(lang === 'bilingual' || lang === 'en' ? { english: enOutput } : {}),
    modelUsed: 'heuristic-engine-v1',
    generatedAt: new Date().toISOString(),
  }
}

/**
 * Main AI Content Generation function.
 * Uses Google Gemini API if input.apiKey or GEMINI_API_KEY is available, or OpenAI if OPENAI_API_KEY is present,
 * with safe fallback to the heuristic copywriting engine.
 */
export async function generateHospitalityContent(input: GenerateContentInput): Promise<GenerateContentOutput> {
  const geminiKey = input.apiKey || process.env.GEMINI_API_KEY
  const openAiKey = (!input.apiKey && process.env.OPENAI_API_KEY) || (input.apiKey?.startsWith('sk-') ? input.apiKey : undefined)

  if (geminiKey && !geminiKey.startsWith('sk-')) {
    try {
      const geminiResult = await callGeminiApi(input, geminiKey)
      if (geminiResult) return geminiResult
    } catch (err) {
      console.warn('[AI Content Generator] Gemini API failed, falling back to heuristic engine:', err)
    }
  }

  if (openAiKey) {
    try {
      const openAiResult = await callOpenAiApi(input, openAiKey)
      if (openAiResult) return openAiResult
    } catch (err) {
      console.warn('[AI Content Generator] OpenAI API failed, falling back to heuristic engine:', err)
    }
  }

  return generateHeuristicContent(input)
}

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash'

/**
 * Validates a Google Gemini API Key by making a minimal ping request.
 */
export async function testGeminiApiKey(apiKey: string, model = DEFAULT_GEMINI_MODEL): Promise<{ ok: boolean; message: string }> {
  if (!apiKey || apiKey.trim().length < 10) {
    return { ok: false, message: 'Khóa API không hợp lệ (chuỗi quá ngắn)' }
  }

  const trimmed = apiKey.trim()
  const candidateModels = Array.from(new Set([model, 'gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash']))

  for (const m of candidateModels) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${trimmed}`
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'ping' }] }],
        }),
      })

      if (response.ok) {
        return { ok: true, message: `Kết nối Google Gemini (${m}) thành công! Sẵn sàng sử dụng.` }
      }

      // If it's a 404 model not found, try the next candidate model
      if (response.status === 404 && m !== candidateModels[candidateModels.length - 1]) {
        continue
      }

      const errorJson = await response.json().catch(() => null)
      const errorMsg = errorJson?.error?.message || `Lỗi kết nối HTTP ${response.status}`
      return { ok: false, message: errorMsg }
    } catch (error: any) {
      if (m === candidateModels[candidateModels.length - 1]) {
        return { ok: false, message: error?.message || 'Không thể kết nối đến máy chủ Google Gemini' }
      }
    }
  }

  return { ok: false, message: 'Không thể kết nối đến máy chủ Google Gemini' }
}

/**
 * Calls Google Gemini REST endpoint directly without heavy SDK dependencies.
 */
async function callGeminiApi(input: GenerateContentInput, apiKey: string): Promise<GenerateContentOutput | null> {
  const prompt = buildAiPrompt(input)
  const targetModel = input.model || DEFAULT_GEMINI_MODEL
  const candidateModels = Array.from(new Set([targetModel, 'gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash']))

  // Prepare multimodal parts (text prompt + inline image data)
  const parts: any[] = [{ text: prompt }]
  if (input.images && input.images.length > 0) {
    for (const img of input.images) {
      if (img.base64 && img.base64.includes('base64,')) {
        const [header, data] = img.base64.split('base64,')
        const mimeMatch = header.match(/data:([^;]+);/)
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg'
        if (data && data.trim()) {
          parts.push({
            inlineData: {
              mimeType,
              data: data.trim(),
            },
          })
        }
      }
    }
  }

  for (const m of candidateModels) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.7,
        },
      }),
    })

    if (!response.ok) {
      // If model not found (404), fall back to next model
      if (response.status === 404 && m !== candidateModels[candidateModels.length - 1]) {
        continue
      }
      const errorText = await response.text().catch(() => '')
      throw new Error(`Gemini (${m}) HTTP ${response.status}: ${errorText}`)
    }

    const json = await response.json()
    const candidateText = json.candidates?.[0]?.content?.parts?.[0]?.text
    if (!candidateText) return null

    return parseAiJsonResponse(candidateText, m)
  }

  return null
}

/**
 * Calls OpenAI chat completions endpoint directly.
 */
async function callOpenAiApi(input: GenerateContentInput, apiKey: string): Promise<GenerateContentOutput | null> {
  const prompt = buildAiPrompt(input)
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an elite hospitality copywriter and SEO expert. Respond ONLY in valid JSON matching the requested schema.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`OpenAI HTTP ${response.status}: ${errorText}`)
  }

  const json = await response.json()
  const content = json.choices?.[0]?.message?.content
  if (!content) return null

  return parseAiJsonResponse(content, 'gpt-4o-mini')
}

function buildAiPrompt(input: GenerateContentInput): string {
  const toneDesc = input.tone ? TONE_DESCRIPTIONS_VI[input.tone] : TONE_DESCRIPTIONS_VI.COZY

  let imagePrompt = ''
  if (input.images && input.images.length > 0) {
    const imgList = input.images
      .map(
        (img, idx) =>
          `- Hình ${idx + 1}: ${img.caption ? `Mô tả: "${img.caption}", ` : ''}Đường dẫn ảnh: ${img.url}`
      )
      .join('\n')

    imagePrompt = `
- HÌNH ẢNH MINH HỌA DO NGƯỜI DÙNG CUNG CẤP (${input.images.length} hình):
${imgList}

YÊU CẦU ĐẶC BIỆT VỀ HÌNH ẢNH:
1. Bạn có đính kèm các hình ảnh thực tế được người dùng tải lên. Hãy quan sát kỹ từng hình (bối cảnh, màu sắc, bố cục, góc chụp, món ăn hoặc tiện nghi).
2. Tự động chèn TẤT CẢ các hình ảnh này vào các vị trí hợp lý nhất trong bài viết 'fullDescription' (và phiên bản tiếng Anh 'english.fullDescription') bằng cú pháp Markdown:
   ![Mô tả chi tiết nội dung bức ảnh](ĐƯỜNG_DẪN_ẢNH)
   *Chú thích ngắn gọn, cảm xúc dưới ảnh*
3. Phân bổ các hình ảnh trải đều trong bài viết (sau lời mở đầu, xen kẽ giữa các phần tiện ích/ẩm thực/trải nghiệm), tuyệt đối không gom tất cả ảnh vào một chỗ.
4. Tận dụng chi tiết thực tế bạn quan sát được từ ảnh để miêu tả bài viết thật chân thực, sống động và hấp dẫn du khách.`
  }

  return `Bạn là chuyên gia viết nội dung quảng bá khách sạn (Hospitality Copywriter & SEO Specialist) hàng đầu.
Nhiệm vụ: Viết đoạn văn mô tả phòng hoặc bài viết tiếp thị khách sạn dựa trên các thông số sau:

- Loại nội dung: ${input.contentType === 'ROOM_DESCRIPTION' ? 'Mô tả hạng phòng khách sạn' : 'Bài viết Blog/Tin tức tiếp thị'}
- Tên phòng / Chủ đề: ${input.roomName || input.topic || 'Không gian nghỉ dưỡng'}
- Diện tích: ${input.area ? `${input.area}m²` : 'Không xác định'}
- Loại giường: ${input.bedType || 'Tiêu chuẩn'}
- Từ khóa nổi bật do chủ khách sạn cung cấp: "${input.keywords}"
- Tên khách sạn: ${input.propertyName || 'Khách sạn'}
- Đối tượng khách hàng mục tiêu: ${input.targetAudience || 'Khách du lịch, cặp đôi, gia đình, khách công tác'}
- Phong cách & Tone giọng: ${toneDesc}
- Ngôn ngữ: ${input.language === 'vi' ? 'Tiếng Việt' : input.language === 'en' ? 'Tiếng Anh' : 'Song ngữ (Tiếng Việt và Tiếng Anh)'}
${imagePrompt}

Yêu cầu nội dung:
1. Viết tự nhiên, cuốn hút, giàu hình ảnh và cảm xúc, mang tính thuyết phục cao (CRO). Tránh các cụm từ sáo rỗng hoặc lặp từ.
2. Tiêu đề (title): Ngắn gọn, hấp dẫn.
3. shortDescription: Đoạn mở đầu ngắn 2-3 câu (khoảng 40-60 từ) tóm gọn điểm đắt giá nhất.
4. fullDescription: Nội dung chi tiết chuẩn Markdown với các tiêu đề mục (###), danh sách gạch đầu dòng tiện ích, câu mời gọi đặt phòng ở cuối.
5. metaTitle: Chuẩn SEO dưới 60 ký tự.
6. metaDescription: Chuẩn SEO từ 120-155 ký tự có chứa từ khóa chính.
7. english: Phiên bản tiếng Anh tương ứng đầy đủ các trường nếu ngôn ngữ là bilingual hoặc en.

Hãy trả về DUY NHẤT một chuỗi JSON hợp lệ theo cấu trúc sau (không kèm markdown \`\`\`):
{
  "title": "string",
  "shortDescription": "string",
  "fullDescription": "string (Markdown format)",
  "metaTitle": "string",
  "metaDescription": "string",
  "english": {
    "title": "string",
    "shortDescription": "string",
    "fullDescription": "string (Markdown format)",
    "metaTitle": "string",
    "metaDescription": "string"
  }
}`
}

function parseAiJsonResponse(text: string, modelUsed: string): GenerateContentOutput {
  let cleaned = text.trim()
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '')
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '')
  }

  let parsed: any
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    const firstBrace = cleaned.indexOf('{')
    const lastBrace = cleaned.lastIndexOf('}')
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1))
    } else {
      throw new Error('Dữ liệu phản hồi từ AI không đúng định dạng JSON yêu cầu.')
    }
  }

  return {
    title: parsed.title || '',
    shortDescription: parsed.shortDescription || '',
    fullDescription: parsed.fullDescription || '',
    metaTitle: parsed.metaTitle || '',
    metaDescription: parsed.metaDescription || '',
    english: parsed.english ? {
      title: parsed.english.title || '',
      shortDescription: parsed.english.shortDescription || '',
      fullDescription: parsed.english.fullDescription || '',
      metaTitle: parsed.english.metaTitle || '',
      metaDescription: parsed.english.metaDescription || '',
    } : undefined,
    modelUsed,
    generatedAt: new Date().toISOString(),
  }
}

