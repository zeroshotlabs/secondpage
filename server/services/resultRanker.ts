import { compareTwoStrings } from 'string-similarity';
import { RawSearchResult } from './ISearchProvider';

export interface RankedResult {
  title: string;
  url: string;
  snippet: string;
  sourceEngine: string;
  originalPosition: number;
  originalPage: number;
  finalScore: number;
  isDuplicate: boolean;
  duplicateOf?: string; // normalized URL of the primary result
  appearances: number;
}

export class ResultRanker {
  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'];
      trackingParams.forEach(param => urlObj.searchParams.delete(param));
      let hostname = urlObj.hostname.replace(/^www\./, '');
      let pathname = urlObj.pathname.replace(/\/$/, '') || '/';
      return `${urlObj.protocol}//${hostname}${pathname}${urlObj.search}`;
    } catch (e) {
      return url;
    }
  }

  private areDuplicates(result1: RawSearchResult, result2: RawSearchResult): boolean {
    const url1 = this.normalizeUrl(result1.url);
    const url2 = this.normalizeUrl(result2.url);
    if (url1 === url2) return true;
    const titleSimilarity = compareTwoStrings(
      result1.title.toLowerCase(),
      result2.title.toLowerCase()
    );
    return titleSimilarity > 0.9;
  }

  private groupDuplicates(results: RawSearchResult[]): Map<number, number[]> {
    const duplicateGroups = new Map<number, number[]>();
    const processed = new Set<number>();
    for (let i = 0; i < results.length; i++) {
      if (processed.has(i)) continue;
      const group = [i];
      for (let j = i + 1; j < results.length; j++) {
        if (processed.has(j)) continue;
        if (this.areDuplicates(results[i], results[j])) {
          group.push(j);
          processed.add(j);
        }
      }
      if (group.length > 0) {
        duplicateGroups.set(i, group);
      }
    }
    return duplicateGroups;
  }

  private calculateBordaScore(position: number, totalResults: number): number {
    return Math.max(0, totalResults - position + 1);
  }

  public rankResults(results: RawSearchResult[]): RankedResult[] {
    if (results.length === 0) return [];
    const duplicateGroups = this.groupDuplicates(results);
    const rankedResults: RankedResult[] = [];

    duplicateGroups.forEach((group, primaryIndex) => {
      const primaryResult = results[primaryIndex];
      let totalScore = 0;
      let appearances = group.length;

      group.forEach(index => {
        const result = results[index];
        const bordaScore = this.calculateBordaScore(result.position, 10);
        const pageBonus = Math.max(0, 5 - result.page);
        const diversityBonus = appearances > 1 ? 10 : 0;
        totalScore += bordaScore + pageBonus + diversityBonus;
      });

      const finalScore = Math.round(totalScore / appearances);
      const primaryNormUrl = this.normalizeUrl(primaryResult.url);

      rankedResults.push({
        title: primaryResult.title,
        url: primaryResult.url,
        snippet: primaryResult.snippet,
        sourceEngine: primaryResult.engine,
        originalPosition: primaryResult.position,
        originalPage: primaryResult.page,
        finalScore,
        isDuplicate: false,
        appearances,
      });

      for (let i = 1; i < group.length; i++) {
        const duplicateResult = results[group[i]];
        rankedResults.push({
          title: duplicateResult.title,
          url: duplicateResult.url,
          snippet: duplicateResult.snippet,
          sourceEngine: duplicateResult.engine,
          originalPosition: duplicateResult.position,
          originalPage: duplicateResult.page,
          finalScore: 0,
          isDuplicate: true,
          duplicateOf: primaryNormUrl,
          appearances: 0,
        });
      }
    });

    const nonDuplicates = rankedResults.filter(r => !r.isDuplicate);
    const duplicates = rankedResults.filter(r => r.isDuplicate);

    nonDuplicates.sort((a, b) => {
      if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
      if (b.appearances !== a.appearances) return b.appearances - a.appearances;
      return a.originalPage - b.originalPage;
    });

    return [...nonDuplicates, ...duplicates];
  }

  public getUniqueResults(rankedResults: RankedResult[]): RankedResult[] {
    return rankedResults.filter(r => !r.isDuplicate);
  }
}
