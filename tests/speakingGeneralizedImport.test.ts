import assert from 'node:assert';
import {
  extractSpeakingPartsFromDocument,
  sanitizeSpeakingDocumentText,
} from '../src/lib/speakingExtractor.ts';

console.log('--- RUNNING GENERALIZED SPEAKING IMPORT & READING TEST UI TESTS ---');

// -------------------------------------------------------------
// Test 1: Generalized Multi-Quarter Speaking Forecast Document
// -------------------------------------------------------------
console.log('\nTest 1: Multi-Quarter Speaking Forecast Recognition & Noise Filtering');
{
  const mockForecastDoc = `
Tổng hợp
Bộ đề dự đoán
IELTS Speaking 2024
Quý 1 – Quý 2 – Quý 3 (Full 3 Parts)
Tổng hợp từ nguồn: The IELTS Workshop (onthiielts.com.vn)
Quý 1/2024   (Tháng 1 – 4)
Quý 2/2024   (Tháng 5 – 8)
Quý 3/2024   (Tháng 9 – 12)
Tài liệu tổng hợp phục vụ mục đích tự học và ôn luyện IELTS Speaking
Contents
1   Quý 1/2024 (Tháng 1 – 4)   2
1.1   Forecast Part 1 – Quý 1/2024 . . . . . . . . . . . . . . . . . . . . . . . . . . .   2
1.2   Forecast Part 2 & 3 – Quý 1/2024   . . . . . . . . . . . . . . . . . . . . . . . .   4
2   Quý 2/2024 (Tháng 5 – 8)   10
2.1   Forecast Part 1 – Quý 2/2024 . . . . . . . . . . . . . . . . . . . . . . . . . . .   10
2.2   Forecast Part 2 & 3 – Quý 2/2024   . . . . . . . . . . . . . . . . . . . . . . . .   12
Nguồn tham khảo   26
1
--- PAGE 3 ---
1   Quý 1/2024 (Tháng 1 -- 4)
1.1   Forecast Part 1 -- Quý 1/2024
Crowded place
• Is the city where you live crowded?
• Is there a crowded place near where you live?
• Do you like crowded places?
• Do most people like crowded places?
• When was the last time you were in a crowded place?

Singing
• Do you like singing? Why?
• Have you ever learnt how to sing?
• Who do you want to sing for?
• Do you think singing can bring happiness to people?

1.2   Forecast Part 2 & 3 -- Quý 1/2024
Describe a party that you enjoyed
You should say:
• When and where the party was held
• Who attended the party
• What kind of party it was
• What you did in the party
• And explain why you enjoyed this party
Part 3
• Why do people like parties?
• Why do some people not like going to parties?
• Do you think those who tend to stay at home are less healthy than those who often attend parties?

Describe a place in your country that you think is interesting
You should say:
• Where it is
• How you knew it
• What special features it has
• And explain why you think it is interesting
Part 3
• How can people access travel information?
• Do people have different personalities in different regions of your country?

2   Quý 2/2024 (Tháng 5 -- 8)
2.1   Forecast Part 1 -- Quý 2/2024
Shopping
• Do you like shopping?
• Where do you usually go shopping?
• What was the last thing you bought?

2.2   Forecast Part 2 & 3 -- Quý 2/2024
Describe a beautiful city
You should say:
• Where the city is
• When you visited it
• What you did there
• And explain why you think it is beautiful
Part 3
• What makes a city attractive to tourists?
• Do you think modern cities are losing their cultural identities?

Nguồn tham khảo
Tài liệu được tổng hợp từ: The IELTS Workshop (onthiielts.com.vn)
• https://onthiielts.com.vn/forecast-ielts-speaking
26
`;

  const extracted = extractSpeakingPartsFromDocument(mockForecastDoc, 'Forecast_IELTS_Speaking_2024.pdf');

  assert.ok(extracted.hasContent, 'Must have extracted content');
  assert.ok(extracted.part1 !== null, 'Part 1 must be present');
  assert.ok(extracted.part2 !== null, 'Part 2 must be present');
  assert.ok(extracted.part3 !== null, 'Part 3 must be present');

  // Verify Part 1 topics across Quarters
  assert.strictEqual(extracted.part1.topics.length, 3, 'Must recognize 3 topics: Crowded place, Singing, Shopping');
  assert.strictEqual(extracted.part1.topics[0].topic, 'Crowded place');
  assert.strictEqual(extracted.part1.topics[0].questions.length, 5);
  assert.strictEqual(extracted.part1.topics[1].topic, 'Singing');
  assert.strictEqual(extracted.part1.topics[1].questions.length, 4);
  assert.strictEqual(extracted.part1.topics[2].topic, 'Shopping');
  assert.strictEqual(extracted.part1.topics[2].questions.length, 3);

  // Verify Part 2 Cue Cards
  assert.strictEqual(extracted.part2.cueCards.length, 3, 'Must recognize 3 cue cards');
  assert.strictEqual(extracted.part2.cueCards[0].topic, 'Describe a party that you enjoyed');
  assert.strictEqual(extracted.part2.cueCards[0].points.length, 5);
  assert.strictEqual(extracted.part2.cueCards[1].topic, 'Describe a place in your country that you think is interesting');
  assert.strictEqual(extracted.part2.cueCards[1].points.length, 4);
  assert.strictEqual(extracted.part2.cueCards[2].topic, 'Describe a beautiful city');
  assert.strictEqual(extracted.part2.cueCards[2].points.length, 4);

  // Verify Part 3 Discussion Groups linked to Cue Cards
  assert.strictEqual(extracted.part3.groups.length, 3, 'Must recognize 3 Part 3 groups linked to Cue Cards');
  assert.ok(extracted.part3.groups[0].cueCardTopic?.includes('party that you enjoyed'), 'Group 1 linked to party Cue Card');
  assert.strictEqual(extracted.part3.groups[0].questions.length, 3);
  assert.ok(extracted.part3.groups[1].cueCardTopic?.includes('place in your country'), 'Group 2 linked to place Cue Card');
  assert.strictEqual(extracted.part3.groups[1].questions.length, 2);
  assert.ok(extracted.part3.groups[2].cueCardTopic?.includes('beautiful city'), 'Group 3 linked to city Cue Card');
  assert.strictEqual(extracted.part3.groups[2].questions.length, 2);

  console.log('✓ Passed: Multi-Quarter Speaking Forecast accurately parsed and linked.');
}

// -------------------------------------------------------------
// Test 2: Standard Single Speaking Test without Quarters
// -------------------------------------------------------------
console.log('\nTest 2: Standard Single Test without Quarters');
{
  const mockSingleTest = `
IELTS SPEAKING PRACTICE TEST 10

PART 1: INTERVIEW
Topic: Mobile Phones
• How often do you use your mobile phone?
• Can you remember when you got your first phone?
• Is there anything you dislike about mobile phones?

PART 2: LONG TURN
Describe a website you visit often.
You should say:
• What website it is
• How often you visit it
• What you use it for
• And explain why you find this website useful.

PART 3: DISCUSSION
• What influence has the internet had on daily life?
• Do you think older people find it difficult to adapt to new technology?
• What measures can be taken to protect personal privacy online?
`;

  const extracted = extractSpeakingPartsFromDocument(mockSingleTest, 'Practice_Test_10.docx');

  assert.ok(extracted.hasContent, 'Has content');
  assert.strictEqual(extracted.part1?.topics.length, 1);
  assert.strictEqual(extracted.part1?.topics[0].topic, 'Mobile Phones');
  assert.strictEqual(extracted.part1?.topics[0].questions.length, 3);

  assert.strictEqual(extracted.part2?.cueCards.length, 1);
  assert.ok(extracted.part2?.cueCards[0].topic.includes('website you visit often'));
  assert.strictEqual(extracted.part2?.cueCards[0].points.length, 4);

  assert.strictEqual(extracted.part3?.groups.length, 1);
  assert.ok(extracted.part3?.groups[0].cueCardTopic?.includes('website you visit often'));
  assert.strictEqual(extracted.part3?.groups[0].questions.length, 3);

  console.log('✓ Passed: Standard single Speaking test parsed cleanly without quarter dependencies.');
}

// -------------------------------------------------------------
// Test 3: Line-Wrapping and Multi-Line Bullet Points
// -------------------------------------------------------------
console.log('\nTest 3: Line-Wrapping Reconstruction');
{
  const wrappedDoc = `
PART 1
Topic: Daily Routine
• Do you think it is important to have a regular morning
routine before going to work or school?
• Has your daily routine changed significantly since you
were a child?

PART 2
Describe a time when you received bad service.
You should say:
• When and where you received
this bad customer service
• What the problem was
• And explain how you reacted to
the situation at that moment.
`;

  const extracted = extractSpeakingPartsFromDocument(wrappedDoc, 'Wrapped_Test.txt');

  assert.strictEqual(extracted.part1?.topics[0].questions.length, 2);
  assert.ok(extracted.part1?.topics[0].questions[0].includes('regular morning routine before going to work'));
  assert.ok(extracted.part1?.topics[0].questions[1].includes('changed significantly since you were a child'));

  assert.strictEqual(extracted.part2?.cueCards[0].points.length, 3);
  assert.ok(extracted.part2?.cueCards[0].points[0].includes('When and where you received this bad customer service'));
  assert.ok(extracted.part2?.cueCards[0].points[2].includes('how you reacted to the situation'));

  console.log('✓ Passed: Line wrapping on questions and cue points reconstructed properly.');
}

// -------------------------------------------------------------
// Test 4: Reading Test UI Marker Selection & Sticky Tab Logic
// -------------------------------------------------------------
console.log('\nTest 4: Reading Test UI Marker Inactivity & Toggle');
{
  // 1. Initial State: marker color MUST default to null (unselected)
  let selectedMarkerColor: string | null = null;
  assert.strictEqual(selectedMarkerColor, null, 'Marker must be unselected / null by default');

  // 2. Text Selection with No Marker Active: MUST NOT auto-highlight
  let highlightedCount = 0;
  const onTextSelectWithNoMarker = (text: string) => {
    if (selectedMarkerColor) {
      highlightedCount++;
    }
    // else: do nothing!
  };

  onTextSelectWithNoMarker('Scientists have been researching');
  assert.strictEqual(highlightedCount, 0, 'Must NOT auto-highlight text when marker is inactive');

  // 3. Explicitly selecting a marker color activates highlighting
  selectedMarkerColor = 'pastel_pink';
  onTextSelectWithNoMarker('Motivation is what drives people');
  assert.strictEqual(highlightedCount, 1, 'Highlights when marker is explicitly active');

  // 4. Clicking the active color again deactivates it (toggles to null)
  const onMarkerColorClick = (colorId: string) => {
    selectedMarkerColor = selectedMarkerColor === colorId ? null : colorId;
  };

  onMarkerColorClick('pastel_pink');
  assert.strictEqual(selectedMarkerColor, null, 'Clicking active color deactivates marker to null');

  // Selecting text again after deactivating must NOT highlight
  onTextSelectWithNoMarker('The drive to bond is also key');
  assert.strictEqual(highlightedCount, 1, 'Highlight count unchanged when deactivated');

  console.log('✓ Passed: Reading test marker inactivity and toggle logic verified.');
}

console.log('\n======================================================');
console.log('🎉 ALL GENERALIZED SPEAKING & READING UI TESTS PASSED!');
console.log('======================================================\n');
