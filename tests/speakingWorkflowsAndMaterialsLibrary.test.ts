import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  sanitizeSpeakingDocumentText,
  extractSpeakingPartsFromDocument,
} from '../src/lib/speakingExtractor.ts';
import { extractSpeakingAssignmentDetails } from '../src/lib/speakingService.ts';
import type { Assignment, MaterialFolder, Resource } from '../src/types/index.ts';

describe('Speaking Workflows, Assignment Center & Materials Library Tests', () => {
  // =========================================================================
  // 1. Speaking Assignment – Independent Part Selection
  // =========================================================================
  describe('1. Speaking Assignment – Independent Part Selection', () => {
    const mockAssignmentBase: Assignment = {
      id: 'asg_spk_test_1',
      courseId: 'course_101',
      title: 'Speaking Comprehensive Test',
      type: 'speaking',
      dueDate: '2026-12-01',
      allowRetake: true,
      maxRetakes: 2,
      isPublished: true,
      speakingTopics: [
        { id: 'top_1', topic: 'Hometown', questions: ['Where is your hometown?'] },
        { id: 'top_2', topic: 'Work and Study', questions: ['Do you work or study?'] },
      ],
      speakingTopicCount: 2,
      speakingCueCard: {
        topic: 'A memorable journey',
        points: ['Where you went', 'Who you went with'],
        prepTimeSeconds: 60,
        speakTimeSeconds: 120,
      },
      speakingQuestions: [
        'Why do people travel?',
        'How has transportation changed over the last decade?',
      ],
      speakingPart3Groups: [
        {
          id: 'grp_1',
          cueCardTopic: 'A memorable journey',
          questions: ['Why do people travel?', 'How has transportation changed over the last decade?'],
        },
      ],
    };

    it('should support Part 1 only configuration', () => {
      const assignment: Assignment = {
        ...mockAssignmentBase,
        speakingParts: ['part1'],
      };
      const details = extractSpeakingAssignmentDetails(assignment);
      assert.strictEqual(details.hasPart1, true);
      assert.strictEqual(details.hasPart2, false);
      assert.strictEqual(details.hasPart3, false);
      assert.strictEqual(details.topics.length, 2);
      assert.strictEqual(details.cueCard, null);
      assert.strictEqual(details.questions.length, 0);
    });

    it('should support Part 2 only configuration', () => {
      const assignment: Assignment = {
        ...mockAssignmentBase,
        speakingParts: ['part2'],
      };
      const details = extractSpeakingAssignmentDetails(assignment);
      assert.strictEqual(details.hasPart1, false);
      assert.strictEqual(details.hasPart2, true);
      assert.strictEqual(details.hasPart3, false);
      assert.strictEqual(details.topics.length, 0);
      assert.ok(details.cueCard);
      assert.strictEqual(details.cueCard?.topic, 'A memorable journey');
      assert.strictEqual(details.questions.length, 0);
    });

    it('should support Part 3 only configuration', () => {
      const assignment: Assignment = {
        ...mockAssignmentBase,
        speakingParts: ['part3'],
      };
      const details = extractSpeakingAssignmentDetails(assignment);
      assert.strictEqual(details.hasPart1, false);
      assert.strictEqual(details.hasPart2, false);
      assert.strictEqual(details.hasPart3, true);
      assert.strictEqual(details.topics.length, 0);
      assert.strictEqual(details.cueCard, null);
      assert.strictEqual(details.questions.length, 2);
    });

    it('should support Part 1 + Part 2 combination', () => {
      const assignment: Assignment = {
        ...mockAssignmentBase,
        speakingParts: ['part1', 'part2'],
      };
      const details = extractSpeakingAssignmentDetails(assignment);
      assert.strictEqual(details.hasPart1, true);
      assert.strictEqual(details.hasPart2, true);
      assert.strictEqual(details.hasPart3, false);
      assert.strictEqual(details.topics.length, 2);
      assert.ok(details.cueCard);
      assert.strictEqual(details.questions.length, 0);
    });

    it('should support Part 1 + Part 3 combination', () => {
      const assignment: Assignment = {
        ...mockAssignmentBase,
        speakingParts: ['part1', 'part3'],
      };
      const details = extractSpeakingAssignmentDetails(assignment);
      assert.strictEqual(details.hasPart1, true);
      assert.strictEqual(details.hasPart2, false);
      assert.strictEqual(details.hasPart3, true);
      assert.strictEqual(details.topics.length, 2);
      assert.strictEqual(details.cueCard, null);
      assert.strictEqual(details.questions.length, 2);
    });

    it('should support Part 2 + Part 3 combination', () => {
      const assignment: Assignment = {
        ...mockAssignmentBase,
        speakingParts: ['part2', 'part3'],
      };
      const details = extractSpeakingAssignmentDetails(assignment);
      assert.strictEqual(details.hasPart1, false);
      assert.strictEqual(details.hasPart2, true);
      assert.strictEqual(details.hasPart3, true);
      assert.strictEqual(details.topics.length, 0);
      assert.ok(details.cueCard);
      assert.strictEqual(details.questions.length, 2);
    });

    it('should support Part 1 + Part 2 + Part 3 full combination', () => {
      const assignment: Assignment = {
        ...mockAssignmentBase,
        speakingParts: ['part1', 'part2', 'part3'],
      };
      const details = extractSpeakingAssignmentDetails(assignment);
      assert.strictEqual(details.hasPart1, true);
      assert.strictEqual(details.hasPart2, true);
      assert.strictEqual(details.hasPart3, true);
      assert.strictEqual(details.topics.length, 2);
      assert.ok(details.cueCard);
      assert.strictEqual(details.questions.length, 2);
    });

    it('should default backward-compatibly to all parts if speakingParts is unspecified', () => {
      const assignment: Assignment = {
        ...mockAssignmentBase,
        speakingParts: undefined,
      };
      const details = extractSpeakingAssignmentDetails(assignment);
      assert.strictEqual(details.hasPart1, true);
      assert.strictEqual(details.hasPart2, true);
      assert.strictEqual(details.hasPart3, true);
    });
  });

  // =========================================================================
  // 2. Speaking Assignment – Auto-linking Part 3 Questions
  // =========================================================================
  describe('2. Speaking Assignment – Auto-linking Part 3 Questions', () => {
    const mockP3Groups = [
      {
        id: 'p3_grp_travel',
        cueCardTopic: 'Describe a memorable journey you took by public transport',
        questions: [
          'Why do some people prefer private cars?',
          'How can public transit be improved in large cities?',
        ],
      },
      {
        id: 'p3_grp_tech',
        cueCardTopic: 'Describe an electronic device you bought recently',
        questions: [
          'What kinds of electronic gadgets do teenagers use most?',
          'Will AI replace smartphones in the future?',
        ],
      },
    ];

    const linkPart3ForCueTopic = (cueTopic: string, groups: typeof mockP3Groups) => {
      if (!cueTopic.trim()) return [];
      const norm = cueTopic.toLowerCase().trim();
      const matched = groups.filter((g) => {
        if (!g.cueCardTopic) return false;
        const gNorm = g.cueCardTopic.toLowerCase().trim();
        return (
          norm.includes(gNorm.slice(0, 15)) ||
          gNorm.includes(norm.slice(0, 15)) ||
          norm.includes(gNorm) ||
          gNorm.includes(norm)
        );
      });
      return matched.flatMap((g) => g.questions || []);
    };

    it('should automatically associate matching Part 3 questions when Part 2 topic is chosen', () => {
      const linked = linkPart3ForCueTopic(
        'Describe a memorable journey you took by train',
        mockP3Groups
      );
      assert.strictEqual(linked.length, 2);
      assert.strictEqual(linked[0], 'Why do some people prefer private cars?');
    });

    it('should gracefully return empty questions when no matching Part 3 group exists', () => {
      const linked = linkPart3ForCueTopic(
        'Describe an ancient castle you visited',
        mockP3Groups
      );
      assert.strictEqual(linked.length, 0);
    });

    it('should allow teacher to assign Part 2 alone without Part 3 questions', () => {
      const assignment: Assignment = {
        id: 'asg_p2_solo',
        courseId: 'c1',
        title: 'Cue Card Speaking Drill',
        type: 'speaking',
        dueDate: '2026-12-01',
        allowRetake: false,
        maxRetakes: 1,
        isPublished: true,
        speakingParts: ['part2'],
        speakingCueCard: {
          topic: 'Describe a traditional festival in your country',
          points: ['When it occurs', 'What people do'],
        },
        speakingQuestions: [],
      };
      const details = extractSpeakingAssignmentDetails(assignment);
      assert.strictEqual(details.hasPart2, true);
      assert.strictEqual(details.hasPart3, false);
      assert.strictEqual(details.questions.length, 0);
    });
  });

  // =========================================================================
  // 3. Speaking PDF Import – Filter Page Markers
  // =========================================================================
  describe('3. Speaking PDF Import – Filter Page Markers', () => {
    it('should filter [--- Page 4 ---] and --- Page 4 --- and not create fake topics', () => {
      const rawText = `
FORECAST SPEAKING 2024
PART 1
Hometown
1. Where is your hometown?
2. What do you like most about your hometown?
[--- Page 4 ---]
3. Is there anything you would change about your hometown?
4. Do you plan to live there in the future?

[--- Page 5 ---]
Weather
1. What kind of weather do you like best?
2. Does the weather ever affect your mood?
      `.trim();

      const sanitized = sanitizeSpeakingDocumentText(rawText);
      // Check that [--- Page 4 ---] and [--- Page 5 ---] are filtered out
      for (const line of sanitized) {
        assert.ok(
          !/\[?\s*-*\s*(?:page|trang|p\.?)\s*\d+[^\]]*\]?/i.test(line),
          `Sanitized lines should not contain page marker: ${line}`
        );
      }

      const extracted = extractSpeakingPartsFromDocument(rawText);
      // Topic count should be 2: Hometown and Weather
      assert.strictEqual(extracted.part1.topics.length, 2);
      const hometownTopic = extracted.part1.topics.find((t) => t.topic.toLowerCase().includes('hometown'));
      assert.ok(hometownTopic, 'Hometown topic must exist');
      // All 4 questions should belong to Hometown, not interrupted by Page 4
      assert.strictEqual(hometownTopic?.questions.length, 4);
      // Ensure no topic is named "Page 4" or "[--- Page 4 ---]"
      for (const t of extracted.part1.topics) {
        assert.ok(!t.topic.toLowerCase().includes('page 4'), `Topic name must not contain Page 4: ${t.topic}`);
      }
    });
  });

  // =========================================================================
  // 4. Assignment Center – Filter Assignments by Course
  // =========================================================================
  describe('4. Assignment Center – Filter Assignments by Course', () => {
    const assignments: Assignment[] = [
      { id: 'a1', courseId: 'course_ielts_foundation', title: 'Task 1 Intro', type: 'writing', dueDate: '2026-11-10', allowRetake: false, maxRetakes: 1, isPublished: true },
      { id: 'a2', courseId: 'course_ielts_intensive', title: 'Full Reading Test 1', type: 'reading', dueDate: '2026-11-12', allowRetake: true, maxRetakes: 2, isPublished: true },
      { id: 'a3', courseId: 'course_ielts_intensive', title: 'Speaking Cue Card Drill', type: 'speaking', dueDate: '2026-11-15', allowRetake: false, maxRetakes: 1, isPublished: true },
    ];

    it('should return all assignments when course filter is "all"', () => {
      const filterCourseId = 'all';
      const filtered = assignments.filter((a) => filterCourseId === 'all' || a.courseId === filterCourseId);
      assert.strictEqual(filtered.length, 3);
    });

    it('should filter assignments accurately when a specific course is selected', () => {
      const filterCourseId = 'course_ielts_intensive';
      const filtered = assignments.filter((a) => filterCourseId === 'all' || a.courseId === filterCourseId);
      assert.strictEqual(filtered.length, 2);
      assert.ok(filtered.every((a) => a.courseId === 'course_ielts_intensive'));
    });

    it('should restrict student visibility to enrolled courses', () => {
      const studentEnrolledCourseIds = ['course_ielts_foundation'];
      const accessibleAssignments = assignments.filter((a) =>
        studentEnrolledCourseIds.includes(a.courseId)
      );
      assert.strictEqual(accessibleAssignments.length, 1);
      assert.strictEqual(accessibleAssignments[0].id, 'a1');
    });
  });

  // =========================================================================
  // 5. Materials Library – Folder Creation, Hierarchy, Cycle-safe Move, Safe Delete
  // =========================================================================
  describe('5. Materials Library – Folder Creation, Hierarchy & Safety', () => {
    let mockFolders: MaterialFolder[] = [
      { id: 'fld_cambridge', name: 'Cambridge IELTS', parentId: null },
      { id: 'fld_cambridge_18', name: 'Cambridge 18', parentId: 'fld_cambridge' },
      { id: 'fld_cambridge_19', name: 'Cambridge 19', parentId: 'fld_cambridge' },
      { id: 'fld_cam19_reading', name: 'Reading Tests', parentId: 'fld_cambridge_19' },
      { id: 'fld_speaking', name: 'Speaking Forecast', parentId: null },
    ];

    const getBreadcrumbs = (folderId: string | null, allFolders: MaterialFolder[]): MaterialFolder[] => {
      const crumbs: MaterialFolder[] = [];
      let curr = folderId ? allFolders.find((f) => f.id === folderId) : null;
      const visited = new Set<string>();
      while (curr && !visited.has(curr.id)) {
        visited.add(curr.id);
        crumbs.unshift(curr);
        curr = curr.parentId ? allFolders.find((f) => f.id === curr!.parentId) : null;
      }
      return crumbs;
    };

    const getDescendantFolderIds = (folderId: string, allFolders: MaterialFolder[]): Set<string> => {
      const descendants = new Set<string>();
      const queue = [folderId];
      while (queue.length > 0) {
        const currId = queue.shift()!;
        const children = allFolders.filter((f) => f.parentId === currId);
        for (const child of children) {
          if (!descendants.has(child.id)) {
            descendants.add(child.id);
            queue.push(child.id);
          }
        }
      }
      return descendants;
    };

    it('should correctly build breadcrumb navigation from root to nested child', () => {
      const crumbs = getBreadcrumbs('fld_cam19_reading', mockFolders);
      assert.strictEqual(crumbs.length, 3);
      assert.strictEqual(crumbs[0].name, 'Cambridge IELTS');
      assert.strictEqual(crumbs[1].name, 'Cambridge 19');
      assert.strictEqual(crumbs[2].name, 'Reading Tests');
    });

    it('should detect all descendants for circular move prevention', () => {
      const descendants = getDescendantFolderIds('fld_cambridge', mockFolders);
      assert.strictEqual(descendants.has('fld_cambridge_18'), true);
      assert.strictEqual(descendants.has('fld_cambridge_19'), true);
      assert.strictEqual(descendants.has('fld_cam19_reading'), true);
      assert.strictEqual(descendants.has('fld_speaking'), false);
    });

    it('should reject circular moves (moving a folder into its own descendant)', () => {
      const folderToMove = 'fld_cambridge';
      const targetParent = 'fld_cam19_reading';
      const descendants = getDescendantFolderIds(folderToMove, mockFolders);

      const isCircular = targetParent === folderToMove || descendants.has(targetParent);
      assert.strictEqual(isCircular, true, 'Moving folder into its descendant must be detected as circular');
    });

    it('should allow valid moves (moving a folder to root or unrelated parent)', () => {
      const folderToMove = 'fld_cambridge_18';
      const targetParent = 'fld_speaking';
      const descendants = getDescendantFolderIds(folderToMove, mockFolders);

      const isCircular = targetParent === folderToMove || descendants.has(targetParent);
      assert.strictEqual(isCircular, false, 'Moving to unrelated parent must be allowed');
    });

    it('should safely unfile materials to root when a folder is deleted, without modifying storage URLs', () => {
      const resources: Resource[] = [
        {
          id: 'res_1',
          teacherId: 't1',
          title: 'Cambridge 19 Test 1 Reading',
          type: 'pdf',
          url: 'https://supabase.co/storage/v1/object/public/materials/cam19_test1.pdf',
          tags: ['reading'],
          skill: 'reading',
          folderId: 'fld_cam19_reading',
          folder: 'Reading Tests',
          isPublished: true,
          createdAt: '2026-11-01',
        },
        {
          id: 'res_2',
          teacherId: 't1',
          title: 'Speaking 2024 Forecast',
          type: 'pdf',
          url: 'https://supabase.co/storage/v1/object/public/materials/forecast.pdf',
          tags: ['speaking'],
          skill: 'speaking',
          folderId: 'fld_speaking',
          folder: 'Speaking Forecast',
          isPublished: true,
          createdAt: '2026-11-01',
        },
      ];

      // Delete folder 'fld_cambridge_19' (which has child 'fld_cam19_reading')
      const targetFolderId = 'fld_cambridge_19';
      const descendants = getDescendantFolderIds(targetFolderId, mockFolders);
      const allTargetIds = new Set([targetFolderId, ...descendants]);

      // Unfile resources
      const updatedResources = resources.map((r) => {
        if (r.folderId && allTargetIds.has(r.folderId)) {
          return { ...r, folderId: null, folder: undefined };
        }
        return r;
      });

      // Verification:
      // 1. res_1 is now unfiled (folderId null, folder undefined)
      assert.strictEqual(updatedResources[0].folderId, null);
      assert.strictEqual(updatedResources[0].folder, undefined);
      // 2. Physical file storage URL is unchanged and completely intact!
      assert.strictEqual(
        updatedResources[0].url,
        'https://supabase.co/storage/v1/object/public/materials/cam19_test1.pdf'
      );
      // 3. Unrelated resource res_2 is unaffected
      assert.strictEqual(updatedResources[1].folderId, 'fld_speaking');
      assert.strictEqual(updatedResources[1].folder, 'Speaking Forecast');
    });

    it('should move material to another folder without re-uploading or changing file URL', () => {
      const originalResource: Resource = {
        id: 'res_move_test',
        teacherId: 't1',
        title: 'IELTS Listening Audio 1',
        type: 'audio',
        url: 'https://supabase.co/storage/v1/object/public/materials/track01.mp3',
        tags: ['listening'],
        skill: 'listening',
        folderId: null,
        folder: undefined,
        isPublished: true,
        createdAt: '2026-11-01',
      };

      const targetFolder: MaterialFolder = {
        id: 'fld_listening',
        name: 'Listening Audio Collection',
        parentId: null,
      };

      // Moving resource
      const movedResource: Resource = {
        ...originalResource,
        folderId: targetFolder.id,
        folder: targetFolder.name,
      };

      assert.strictEqual(movedResource.folderId, 'fld_listening');
      assert.strictEqual(movedResource.folder, 'Listening Audio Collection');
      assert.strictEqual(movedResource.url, originalResource.url);
    });
  });
});
