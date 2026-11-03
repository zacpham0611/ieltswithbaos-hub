import type { SpeakingTopic, SpeakingPart3Group } from '../types';

export interface SpeakingResourceDetails {
  topics: SpeakingTopic[];
  cueCards: Array<{ id?: string; topic: string; points: string[] }>;
  groups: SpeakingPart3Group[];
  questions: string[];
}

/**
 * Extracts normalized speaking components (Part 1 topics, Part 2 cue cards, Part 3 groups & questions)
 * from a resource object or its raw JSON content.
 */
export function getSpeakingResourceDetails(res: any): SpeakingResourceDetails {
  if (!res) {
    return { topics: [], cueCards: [], groups: [], questions: [] };
  }

  let parsedContent: any = {};
  if (res.content && typeof res.content === 'string') {
    try {
      parsedContent = JSON.parse(res.content);
    } catch {
      // Content may be plain text
    }
  } else if (res.content && typeof res.content === 'object') {
    parsedContent = res.content;
  }

  // 1. Part 1 Topics
  const topics: SpeakingTopic[] =
    res.speakingPart1?.topics ||
    parsedContent.topics ||
    parsedContent.speakingPart1?.topics ||
    [];

  // 2. Part 2 Cue Cards
  let cueCards: Array<{ id?: string; topic: string; points: string[] }> =
    res.speakingPart2?.cueCards ||
    parsedContent.cueCards ||
    parsedContent.speakingPart2?.cueCards ||
    [];

  if (cueCards.length === 0) {
    if (res.speakingCueCards && Array.isArray(res.speakingCueCards) && res.speakingCueCards.length > 0) {
      cueCards = res.speakingCueCards;
    } else if (res.speakingCueCard) {
      cueCards = [res.speakingCueCard];
    } else if (parsedContent.cueCard) {
      cueCards = [parsedContent.cueCard];
    } else if (res.speakingTopic || parsedContent.topic) {
      cueCards = [
        {
          id: res.id ? `card_${res.id}` : undefined,
          topic: res.speakingTopic || parsedContent.topic,
          points: res.speakingPoints ||
            parsedContent.points || [
              'What it is',
              'Why it matters to you',
              'How you feel about it',
            ],
        },
      ];
    }
  }

  // 3. Part 3 Groups
  const groups: SpeakingPart3Group[] =
    res.speakingPart3?.groups ||
    parsedContent.groups ||
    parsedContent.speakingPart3?.groups ||
    res.speakingPart3Groups ||
    [];

  // 4. Standalone / Flattened Part 3 Questions
  const questions: string[] =
    res.speakingPart3?.questions ||
    parsedContent.questions ||
    parsedContent.speakingPart3?.questions ||
    res.speakingQuestions ||
    groups.flatMap((g: any) => g.questions || []);

  return { topics, cueCards, groups, questions };
}

/**
 * Searches across the speaking library and companion resources to retrieve the Part 3 groups
 * associated with given Part 2 cue cards.
 * STRICT 1-to-1 LINKAGE RULE: Each Part 2 cue card links to AT MOST ONE corresponding Part 3 question group.
 */
export function findAssociatedPart3GroupsForCards(
  cards: Array<{ id?: string; topic: string }>,
  currentResource: any | null | undefined,
  allResources?: any[]
): { matchedGroups: SpeakingPart3Group[]; companionResource: any | null } {
  if (!cards || cards.length === 0) {
    return { matchedGroups: [], companionResource: null };
  }

  const poolWithResource: Array<{ group: SpeakingPart3Group; res: any }> = [];

  // 1. Current resource
  if (currentResource) {
    const details = getSpeakingResourceDetails(currentResource);
    details.groups.forEach((g) => poolWithResource.push({ group: g, res: currentResource }));
  }

  // 2. All library resources
  (allResources || []).forEach((r) => {
    if (currentResource && r.id === currentResource.id) return;
    const details = getSpeakingResourceDetails(r);
    if (details.groups && details.groups.length > 0) {
      details.groups.forEach((g) => poolWithResource.push({ group: g, res: r }));
    }
  });

  const matchedGroups: SpeakingPart3Group[] = [];
  const matchedGroupIds = new Set<string>();
  let companionRes: any | null = null;

  // Enforce strict 1-to-1 linkage: evaluate each card individually to find its single best match
  for (const card of cards) {
    const cardId = (card as any).id;
    const cardTopic = (card.topic || '').trim().toLowerCase();
    const cleanCardTopic = cardTopic.replace(/^(describe|talk about|a|an|the)\s+/i, '').trim();

    let bestMatch: { group: SpeakingPart3Group; res: any; score: number } | null = null;

    for (const item of poolWithResource) {
      const g = item.group;
      const gId = g.id || `g_${g.cueCardTopic || ''}_${(g.questions || []).length}`;
      if (matchedGroupIds.has(gId)) continue; // Already matched to another card

      let score = 0;

      // 1. Exact ID match (highest priority: score 100)
      if (cardId && g.cueCardId && g.cueCardId === cardId) {
        score = 100;
      } else {
        const gTopic = (g.cueCardTopic || '').trim().toLowerCase();
        const cleanGTopic = gTopic.replace(/^(describe|talk about|a|an|the)\s+/i, '').trim();

        if (gTopic && cardTopic) {
          if (gTopic === cardTopic || cleanGTopic === cleanCardTopic) {
            score = 90; // Exact topic match
          } else if (
            (cleanGTopic.length >= 4 && cleanCardTopic.includes(cleanGTopic)) ||
            (cleanCardTopic.length >= 4 && cleanGTopic.includes(cleanCardTopic))
          ) {
            score = 70; // High substring match
          } else if (
            (cleanGTopic.length >= 4 && cleanCardTopic.slice(0, 15) === cleanGTopic.slice(0, 15)) ||
            (cleanCardTopic.length >= 4 && cleanGTopic.slice(0, 15) === cleanCardTopic.slice(0, 15))
          ) {
            score = 50; // Prefix match
          }
        }
      }

      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { group: g, res: item.res, score };
      }
    }

    if (bestMatch && bestMatch.score >= 50) {
      const gId = bestMatch.group.id || `g_${bestMatch.group.cueCardTopic || ''}_${(bestMatch.group.questions || []).length}`;
      matchedGroupIds.add(gId);
      matchedGroups.push(bestMatch.group);
      if (!companionRes && currentResource && bestMatch.res.id !== currentResource.id) {
        companionRes = bestMatch.res;
      }
    }
  }

  return { matchedGroups, companionResource: companionRes };
}
