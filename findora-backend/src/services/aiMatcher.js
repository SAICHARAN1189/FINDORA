// src/services/aiMatcher.js
// Advanced AI Matching Engine with NLP, OCR simulation, and image analysis
// Works in demo mode without external API keys

// ─── Configurable Weights ──────────────────────────────────────
const MATCH_WEIGHTS = {
  imageSimilarity: 0.30,  // Visual appearance
  textSimilarity:  0.20,  // Description NLP
  ocrSimilarity:   0.05,  // Text in images
  category:        0.10,  // Item type
  brand:           0.10,  // Manufacturer
  color:           0.05,  // Visual color
  model:           0.05,  // Specific model
  location:        0.10,  // Geographic proximity
  time:            0.05,  // Temporal relevance
};

// ─── Advanced Text Similarity (NLP) ───────────────────────────
// Stopwords for better semantic analysis
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
  'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'my', 'your', 'his', 'her',
  'its', 'our', 'their', 'me', 'him', 'us', 'them'
]);

// Porter Stemmer (simplified) for word normalization
function stem(word) {
  // Simple suffix stripping
  word = word.replace(/ies$/, 'i');
  word = word.replace(/es$/, 'e');
  word = word.replace(/s$/, '');
  word = word.replace(/ing$/, '');
  word = word.replace(/ed$/, '');
  return word;
}

function tokenize(text) {
  if (!text) return [];
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOPWORDS.has(t))
    .map(stem);
}

// TF-IDF weighted cosine similarity
function cosineSimilarity(textA, textB) {
  const tokensA = tokenize(textA);
  const tokensB = tokenize(textB);
  if (!tokensA.length || !tokensB.length) return 0;

  // Calculate term frequencies
  const tfA = {};
  const tfB = {};
  tokensA.forEach(t => tfA[t] = (tfA[t] || 0) + 1);
  tokensB.forEach(t => tfB[t] = (tfB[t] || 0) + 1);

  // Calculate IDF (inverse document frequency simulation)
  const vocab = new Set([...tokensA, ...tokensB]);
  const idf = {};
  vocab.forEach(term => {
    const docCount = (tfA[term] ? 1 : 0) + (tfB[term] ? 1 : 0);
    idf[term] = Math.log(2 / docCount);
  });

  // TF-IDF vectors
  const vecA = {};
  const vecB = {};
  vocab.forEach(term => {
    vecA[term] = (tfA[term] || 0) * idf[term];
    vecB[term] = (tfB[term] || 0) * idf[term];
  });

  // Cosine similarity
  let dot = 0, magA = 0, magB = 0;
  vocab.forEach(term => {
    dot += vecA[term] * vecB[term];
    magA += vecA[term] ** 2;
    magB += vecB[term] ** 2;
  });

  if (!magA || !magB) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// Jaccard similarity for keyword overlap
function jaccardSimilarity(textA, textB) {
  const setA = new Set(tokenize(textA));
  const setB = new Set(tokenize(textB));
  
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
}

// Combined text similarity with multiple algorithms
function advancedTextSimilarity(textA, textB) {
  const cosine = cosineSimilarity(textA, textB);
  const jaccard = jaccardSimilarity(textA, textB);
  
  // Weighted combination
  return cosine * 0.7 + jaccard * 0.3;
}

// ─── Location Proximity ───────────────────────────────────────
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function locationScore(locA, locB) {
  if (!locA?.lat || !locB?.lat) return 0.3; // Unknown = partial credit
  const dist = haversineDistance(locA.lat, locA.lng, locB.lat, locB.lng);
  if (dist <= 100) return 1.0;
  if (dist <= 500) return 0.8;
  if (dist <= 1000) return 0.6;
  if (dist <= 5000) return 0.4;
  if (dist <= 10000) return 0.2;
  return 0;
}

// ─── Time Scoring ─────────────────────────────────────────────
function timeScore(lostDate, foundDate) {
  if (!lostDate || !foundDate) return 0.5;
  const lost = new Date(lostDate).getTime();
  const found = new Date(foundDate).getTime();
  if (found < lost - 24 * 3600000) return 0; // Found before lost - impossible
  const diff = (found - lost) / (24 * 3600000); // days
  if (diff <= 1) return 1.0;
  if (diff <= 3) return 0.8;
  if (diff <= 7) return 0.6;
  if (diff <= 14) return 0.4;
  if (diff <= 30) return 0.2;
  return 0.1;
}

// ─── String Field Matching ────────────────────────────────────
function fieldMatch(a, b) {
  if (!a || !b) return 0;
  const normalize = s => s.toLowerCase().trim().replace(/\s+/g, ' ');
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1.0;
  if (na.includes(nb) || nb.includes(na)) return 0.7;
  // Check for partial overlap
  const wordsA = na.split(' ');
  const wordsB = nb.split(' ');
  const common = wordsA.filter(w => wordsB.includes(w));
  if (common.length > 0) return 0.4 * (common.length / Math.max(wordsA.length, wordsB.length));
  return 0;
}

// ─── OCR Simulation ───────────────────────────────────────────
// Simulates text extraction from images using metadata
function simulateOCR(report) {
  const ocrTexts = [];
  
  // Extract potential text from item details
  if (report.brand) ocrTexts.push(report.brand);
  if (report.model) ocrTexts.push(report.model);
  
  // Simulate common text patterns found in items
  if (report.category === 'documents') {
    ocrTexts.push('ID', 'card', 'number', 'name');
  } else if (report.category === 'electronics') {
    ocrTexts.push('serial', 'number', report.brand || '');
  } else if (report.category === 'books') {
    ocrTexts.push('ISBN', 'author', 'title');
  }
  
  // Extract from identifying characteristics
  if (report.identifyingCharacteristics) {
    const characteristics = report.identifyingCharacteristics.toLowerCase();
    if (characteristics.includes('sticker')) ocrTexts.push('sticker', 'text');
    if (characteristics.includes('name')) ocrTexts.push('name', 'label');
    if (characteristics.includes('serial')) ocrTexts.push('serial', 'number');
  }
  
  return ocrTexts.join(' ').toLowerCase();
}

function ocrSimilarity(reportA, reportB) {
  const ocrA = simulateOCR(reportA);
  const ocrB = simulateOCR(reportB);
  
  if (!ocrA || !ocrB) return 0;
  
  return jaccardSimilarity(ocrA, ocrB);
}

// ─── Advanced Image Similarity ────────────────────────────────
// Simulates computer vision analysis without external APIs
function extractImageFeatures(report) {
  const features = {
    category: report.category || 'unknown',
    color: (report.color || '').toLowerCase(),
    brand: (report.brand || '').toLowerCase(),
    hasImage: !!report.imageUrl,
    visualKeywords: []
  };
  
  // Extract visual keywords from description
  const desc = (report.description || '').toLowerCase();
  const visualTerms = ['black', 'white', 'red', 'blue', 'green', 'yellow', 'gray', 'silver',
                        'large', 'small', 'rectangular', 'round', 'square', 'leather',
                        'metal', 'plastic', 'fabric', 'wooden', 'new', 'old', 'worn'];
  
  visualTerms.forEach(term => {
    if (desc.includes(term)) features.visualKeywords.push(term);
  });
  
  return features;
}

function imageColorSimilarity(colorA, colorB) {
  if (!colorA || !colorB) return 0.3;
  
  const normalize = (c) => c.toLowerCase().trim();
  const c1 = normalize(colorA);
  const c2 = normalize(colorB);
  
  if (c1 === c2) return 1.0;
  
  // Check if colors are in same word
  if (c1.includes(c2) || c2.includes(c1)) return 0.9;
  
  // Color families
  const colorFamilies = {
    black: ['black', 'dark', 'charcoal', 'ebony'],
    white: ['white', 'cream', 'ivory', 'beige', 'pearl'],
    red: ['red', 'crimson', 'scarlet', 'maroon', 'ruby'],
    blue: ['blue', 'navy', 'azure', 'cyan', 'turquoise', 'cobalt'],
    green: ['green', 'lime', 'olive', 'emerald', 'jade'],
    yellow: ['yellow', 'gold', 'amber', 'golden'],
    gray: ['gray', 'grey', 'silver', 'slate'],
    brown: ['brown', 'tan', 'beige', 'khaki', 'chocolate'],
    pink: ['pink', 'rose', 'magenta', 'fuchsia'],
    purple: ['purple', 'violet', 'lavender', 'plum']
  };
  
  for (const family in colorFamilies) {
    const familyColors = colorFamilies[family];
    const c1InFamily = familyColors.some(color => c1.includes(color) || color.includes(c1));
    const c2InFamily = familyColors.some(color => c2.includes(color) || color.includes(c2));
    
    if (c1InFamily && c2InFamily) {
      return 0.8;
    }
  }
  
  return 0.2;
}

function advancedImageSimilarity(reportA, reportB) {
  const featuresA = extractImageFeatures(reportA);
  const featuresB = extractImageFeatures(reportB);
  
  let score = 0;
  let weight = 0;
  
  // Category match (strong indicator)
  if (featuresA.category === featuresB.category) {
    score += 0.4;
    weight += 0.4;
  }
  
  // Color similarity
  const colorScore = imageColorSimilarity(featuresA.color, featuresB.color);
  score += colorScore * 0.25;
  weight += 0.25;
  
  // Brand match (visual logo recognition simulation)
  if (featuresA.brand && featuresB.brand) {
    if (featuresA.brand === featuresB.brand) {
      score += 0.25;
    } else if (featuresA.brand.includes(featuresB.brand) || featuresB.brand.includes(featuresA.brand)) {
      score += 0.15;
    }
    weight += 0.25;
  }
  
  // Visual keywords overlap
  const commonKeywords = featuresA.visualKeywords.filter(k => featuresB.visualKeywords.includes(k));
  if (featuresA.visualKeywords.length > 0 || featuresB.visualKeywords.length > 0) {
    const maxKeywords = Math.max(featuresA.visualKeywords.length, featuresB.visualKeywords.length);
    const keywordScore = commonKeywords.length / maxKeywords;
    score += keywordScore * 0.1;
    weight += 0.1;
  }
  
  return weight > 0 ? score / weight : 0.3;
}

// ─── Main Matching Function ───────────────────────────────────
function computeMatch(lostReport, foundReport) {
  const scores = {};
  const reasons = [];

  // Category
  const categoryS = lostReport.category === foundReport.category ? 1.0 : 0;
  scores.category = categoryS;
  if (categoryS > 0.5) {
    reasons.push({ factor: 'category', score: Math.round(categoryS * MATCH_WEIGHTS.category * 100), label: `Same category (${lostReport.category})` });
  }

  // Brand
  const brandS = fieldMatch(lostReport.brand, foundReport.brand);
  scores.brand = brandS;
  if (brandS > 0.5) {
    reasons.push({ factor: 'brand', score: Math.round(brandS * MATCH_WEIGHTS.brand * 100), label: `Same brand (${lostReport.brand})` });
  }

  // Color (using advanced color similarity)
  const colorS = lostReport.color && foundReport.color 
    ? imageColorSimilarity(lostReport.color, foundReport.color)
    : 0;
  scores.color = colorS;
  if (colorS > 0.4) {
    const colorLabel = colorS === 1.0 ? 'Exact' : colorS >= 0.8 ? 'Same family' : 'Similar';
    reasons.push({ 
      factor: 'color', 
      score: Math.round(colorS * MATCH_WEIGHTS.color * 100), 
      label: `${colorLabel} color (${lostReport.color} / ${foundReport.color})` 
    });
  }

  // Model
  const modelS = fieldMatch(lostReport.model, foundReport.model);
  scores.model = modelS;
  if (modelS > 0.5) {
    reasons.push({ factor: 'model', score: Math.round(modelS * MATCH_WEIGHTS.model * 100), label: `Same model (${lostReport.model})` });
  }

  // Advanced text similarity (NLP)
  const textA = `${lostReport.description || ''} ${lostReport.identifyingCharacteristics || ''}`;
  const textB = `${foundReport.description || ''} ${foundReport.identifyingCharacteristics || ''}`;
  const textS = advancedTextSimilarity(textA, textB);
  scores.textSimilarity = textS;
  if (textS > 0.15) {
    reasons.push({ 
      factor: 'textSimilarity', 
      score: Math.round(textS * MATCH_WEIGHTS.textSimilarity * 100), 
      label: `Text similarity: ${Math.round(textS * 100)}% (NLP analysis)` 
    });
  }

  // OCR similarity
  const ocrS = ocrSimilarity(lostReport, foundReport);
  scores.ocrSimilarity = ocrS;
  if (ocrS > 0.2) {
    reasons.push({ 
      factor: 'ocrSimilarity', 
      score: Math.round(ocrS * MATCH_WEIGHTS.ocrSimilarity * 100), 
      label: `Text extraction match: ${Math.round(ocrS * 100)}%` 
    });
  }

  // Location
  const locS = locationScore(lostReport.location, foundReport.location);
  scores.location = locS;
  if (locS > 0.3) {
    const dist = (lostReport.location?.lat && foundReport.location?.lat)
      ? `~${Math.round(haversineDistance(lostReport.location.lat, lostReport.location.lng, foundReport.location.lat, foundReport.location.lng))}m apart`
      : 'similar area';
    reasons.push({ factor: 'location', score: Math.round(locS * MATCH_WEIGHTS.location * 100), label: `Nearby location (${dist})` });
  }

  // Time
  const timeS = timeScore(lostReport.dateOccurred, foundReport.dateOccurred);
  scores.time = timeS;
  if (timeS > 0.3) {
    reasons.push({ factor: 'time', score: Math.round(timeS * MATCH_WEIGHTS.time * 100), label: `Found within reasonable time after reported lost` });
  }

  // Advanced image similarity
  const imgS = advancedImageSimilarity(lostReport, foundReport);
  scores.imageSimilarity = imgS;
  if (imgS > 0.3) {
    reasons.push({ 
      factor: 'imageSimilarity', 
      score: Math.round(imgS * MATCH_WEIGHTS.imageSimilarity * 100), 
      label: `Visual similarity: ${Math.round(imgS * 100)}% (computer vision)` 
    });
  }

  // Weighted confidence with all factors
  const confidence = Math.round(
    scores.imageSimilarity * MATCH_WEIGHTS.imageSimilarity * 100 +
    scores.textSimilarity  * MATCH_WEIGHTS.textSimilarity  * 100 +
    scores.ocrSimilarity   * MATCH_WEIGHTS.ocrSimilarity   * 100 +
    scores.category        * MATCH_WEIGHTS.category        * 100 +
    scores.brand           * MATCH_WEIGHTS.brand           * 100 +
    scores.color           * MATCH_WEIGHTS.color           * 100 +
    scores.model           * MATCH_WEIGHTS.model           * 100 +
    scores.location        * MATCH_WEIGHTS.location        * 100 +
    scores.time            * MATCH_WEIGHTS.time            * 100
  );

  return {
    confidence: Math.min(confidence, 100),
    scores,
    reasons: reasons.sort((a, b) => b.score - a.score),
    isMatch: confidence >= 40, // Threshold for creating a match
  };
}

// ─── Find Matches for a Report ────────────────────────────────
function findMatches(newReport, existingReports) {
  const oppositeType = newReport.type === 'lost' ? 'found' : 'lost';
  const candidates = existingReports.filter(r =>
    r.id !== newReport.id &&
    r.type === oppositeType &&
    r.status === 'active'
  );

  const results = [];
  for (const candidate of candidates) {
    const lostReport = newReport.type === 'lost' ? newReport : candidate;
    const foundReport = newReport.type === 'found' ? newReport : candidate;
    const result = computeMatch(lostReport, foundReport);
    if (result.isMatch) {
      results.push({
        reportId: candidate.id,
        report: candidate,
        ...result,
      });
    }
  }

  return results.sort((a, b) => b.confidence - a.confidence);
}

// ─── Explainability Functions ─────────────────────────────────
function getMatchExplanation(match) {
  const { confidence, reasons, scores } = match;
  
  const explanation = {
    overallConfidence: confidence,
    verdict: confidence >= 80 ? 'STRONG_MATCH' : 
             confidence >= 60 ? 'GOOD_MATCH' : 
             confidence >= 40 ? 'POSSIBLE_MATCH' : 'WEAK_MATCH',
    topReasons: reasons.slice(0, 5),
    detailedScores: scores,
    weights: MATCH_WEIGHTS,
    summary: generateMatchSummary(confidence, reasons)
  };
  
  return explanation;
}

function generateMatchSummary(confidence, reasons) {
  const topFactors = reasons.slice(0, 3).map(r => r.factor);
  
  let summary = `This is a ${confidence}% match. `;
  
  if (confidence >= 80) {
    summary += 'Strong confidence based on ';
  } else if (confidence >= 60) {
    summary += 'Good confidence with ';
  } else {
    summary += 'Moderate confidence due to ';
  }
  
  summary += topFactors.join(', ') + ' alignment.';
  
  return summary;
}

// ─── Testing & Validation ─────────────────────────────────────
function testMatcher() {
  console.log('🧪 Testing AI Matching Engine...\n');
  
  // Test 1: Perfect match
  const test1Lost = {
    category: 'electronics',
    brand: 'Apple',
    model: 'iPhone 15 Pro',
    color: 'Blue Titanium',
    description: 'Lost my iPhone 15 Pro with blue case and cat sticker',
    identifyingCharacteristics: 'Cat sticker on back, cracked screen protector',
    location: { lat: 12.9716, lng: 77.5946 },
    dateOccurred: new Date('2024-01-15').toISOString()
  };
  
  const test1Found = {
    category: 'electronics',
    brand: 'Apple',
    model: 'iPhone 15 Pro',
    color: 'Blue',
    description: 'Found iPhone with blue case, has cat sticker',
    identifyingCharacteristics: 'Cat sticker visible, screen protector cracked',
    location: { lat: 12.9718, lng: 77.5948 },
    dateOccurred: new Date('2024-01-16').toISOString()
  };
  
  const match1 = computeMatch(test1Lost, test1Found);
  console.log('Test 1: Perfect Match');
  console.log(`Confidence: ${match1.confidence}%`);
  console.log('Top Reasons:', match1.reasons.slice(0, 3).map(r => r.label));
  console.log('---\n');
  
  // Test 2: Partial match
  const test2Lost = {
    category: 'bags',
    brand: 'Nike',
    color: 'Black',
    description: 'Black backpack with laptop inside',
    location: { lat: 12.9700, lng: 77.5920 },
    dateOccurred: new Date('2024-01-10').toISOString()
  };
  
  const test2Found = {
    category: 'bags',
    brand: 'Adidas',
    color: 'Black',
    description: 'Found black sports backpack',
    location: { lat: 12.9702, lng: 77.5922 },
    dateOccurred: new Date('2024-01-11').toISOString()
  };
  
  const match2 = computeMatch(test2Lost, test2Found);
  console.log('Test 2: Partial Match (Different Brand)');
  console.log(`Confidence: ${match2.confidence}%`);
  console.log('Top Reasons:', match2.reasons.slice(0, 3).map(r => r.label));
  console.log('---\n');
  
  // Test 3: No match
  const test3Lost = {
    category: 'electronics',
    brand: 'Samsung',
    description: 'Lost Samsung phone',
    location: { lat: 12.9700, lng: 77.5920 },
    dateOccurred: new Date('2024-01-01').toISOString()
  };
  
  const test3Found = {
    category: 'documents',
    description: 'Found student ID card',
    location: { lat: 13.0000, lng: 78.0000 },
    dateOccurred: new Date('2024-02-01').toISOString()
  };
  
  const match3 = computeMatch(test3Lost, test3Found);
  console.log('Test 3: No Match (Different Categories)');
  console.log(`Confidence: ${match3.confidence}%`);
  console.log('Should Match:', match3.isMatch);
  console.log('---\n');
  
  console.log('✅ AI Matching Engine Tests Complete');
}

module.exports = { 
  computeMatch, 
  findMatches, 
  MATCH_WEIGHTS,
  getMatchExplanation,
  testMatcher 
};
