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
 * Searches across the speaking library and companion resources to retrieve all Part 3 groups
 * associated with given Part 2 cue cards. Matches by card ID, topic substring, or companion document naming.
 */
export function findAssociatedPart3GroupsForCards(
  cards: Array<{ id?: string; topic: string }>,
  currentResource: any | null | undefined,
  allResources: any[]
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
  const currentBaseName = currentResource?.title
    ? currentResource.title.replace(/\s*-\s*Speaking Part \d.*$/i, '').trim().toLowerCase()
    : '';
  const currentDocName = (currentResource?.sourceDocumentName || '').trim().toLowerCase();

  (allResources || []).forEach((r) => {
    if (currentResource && r.id === currentResource.id) return;
    const details = getSpeakingResourceDetails(r);
    if (details.groups && details.groups.length > 0) {
      details.groups.forEach((g) => poolWithResource.push({ group: g, res: r }));
    }
  });

  const matched: SpeakingPart3Group[] = [];
  let companionRes: any | null = null;

  poolWithResource.forEach(({ group: g, res: r }) => {
    const gTopic = (g.cueCardTopic || '').toLowerCase().trim();
    const isCardMatch = cards.some((card) => {
      const cardTopic = (card.topic || '').toLowerCase().trim();
      const cardId = (card as any).id;
      if (g.cueCardId && cardId && g.cueCardId === cardId) return true;
      if (gTopic && cardTopic) {
        if (
          cardTopic.includes(gTopic.slice(0, 15)) ||
          gTopic.includes(cardTopic.slice(0, 15)) ||
          cardTopic === gTopic
        ) {
          return true;
        }
      }
      return false;
    });

    const rBaseName = (r.title || '').replace(/\s*-\s*Speaking Part \d.*$/i, '').trim().toLowerCase();
    const rDocName = (r.sourceDocumentName || '').trim().toLowerCase();
    const isCompanionDoc =
      (currentDocName && rDocName && currentDocName === rDocName) ||
      (currentBaseName && rBaseName && currentBaseName === rBaseName);

    if (isCardMatch || (isCompanionDoc && (!g.cueCardTopic || isCardMatch))) {
      if (
        !matched.some(
          (m) =>
            m.id === g.id ||
            (m.cueCardTopic === g.cueCardTopic && m.questions?.length === g.questions?.length)
        )
      ) {
        matched.push(g);
        if (!companionRes && r.id !== currentResource?.id) {
          companionRes = r;
        }
      }
    }
  });

  return { matchedGroups: matched, companionResource: companionRes };
}
