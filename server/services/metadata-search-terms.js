"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanMetadataSearchTitle = cleanMetadataSearchTitle;
exports.deriveMetadataSearchCandidates = deriveMetadataSearchCandidates;
exports.deriveMetadataSearchTerms = deriveMetadataSearchTerms;
exports.deriveMetadataSearchQueryVariants = deriveMetadataSearchQueryVariants;
const AUTHOR_PREFIX = String.raw `(?:작가|저자|글쓴이|글|by)`;
const COMPLETE = String.raw `(?:완결|완|完)`;
const EPISODE_UNIT = String.raw `(?:화|회|편|장|chapter|chap|ch|episode|ep)`;
const VOLUME_UNIT = String.raw `(?:권|부|book|vol(?:ume)?)`;
const STANDALONE_VOLUME_UNIT = String.raw `(?:권|book|vol(?:ume)?)`;
const ANY_UNIT = String.raw `(?:${EPISODE_UNIT}|${VOLUME_UNIT})`;
const DASH_RANGE = String.raw `\d{1,7}\s*(?:${ANY_UNIT})?\s*[-~～–—]\s*\d{1,7}\s*(?:${ANY_UNIT})?`;
const SPACE_RANGE = String.raw `\d{1,7}\s+\d{1,7}\s*(?:${ANY_UNIT})?`;
const RANGE = String.raw `(?:${DASH_RANGE}|${SPACE_RANGE})`;
const RELEASE_WORD = String.raw `(?:${COMPLETE}\d{0,2}(?:부(?:까지)?)?|연재중?|미완결|외전|번외|에필(?:로그)?|후기|후일담|본편|특별편|side\s*story|외포|왼외|수정|포함|완본|완결본|작업완료|공금|갠소|#?ex|텍본|스캔본|합본|총\s*\d{1,7}\s*(?:${ANY_UNIT}))`;
const GENERIC_FOLDER_NAMES = new Set([
    'txt', 'text', 'novel', 'novels', 'book', 'books', 'download', 'downloads', 'archive',
    '소설', '웹소설', '장르소설', '연재소설', '완결소설', '텍본', '텍스트', '작품', '자료',
    '다운로드', '완결', '연재', '연재중', '미완결', '미분류', '기타', '모음', '모음집', '신작', '구작', '백업',
    '정리', '옛날', '최신', '최신본', '완결본', '수집', '외부', 'external',
    '판타지', '현대', '현대판타지', '현판', '무협', '로맨스', '로판', '퓨전판타지', '게임판타지',
    '스포츠', '대체역사', '선협', '성인', '일반', '북토끼', '네이버시리즈', '카카오페이지',
    '문피아', '조아라', '노벨피아', '리디', '리디북스'
]);
const NOISE_TAG_PATTERN = /^(?:완결(?:본)?|완|完|연재중?|연재|미완결|텍본|텍스트|스캔(?:본)?|웹소설|장르소설|단행본|합본|개정판|완전판|리마스터(?:판)?|리메이크|특별판|애장판|합본판|외전(?:포함)?|본편|독점|선공개|19(?:금|세|n)|성인|무료|유료|미결|구버전|무료끝|작품후기\s*제거|후기|에필로그|공금|갠소|작업완료|e-?book|현판|현대\s*판타지|현대판타지|현대|판타지|무협|로맨스|로판|퓨전\s*판타지|퓨전판타지|게임\s*판타지|게임판타지|스포츠|대체역사|선협|삼국지|네이버(?:시리즈)?|카카오페이지|문피아|조아라|노벨피아|novelpia|munpia|kakaopage|naver(?:series)?|리디(?:북스)?|상|중|하|전편|후편|근친)$/iu;
const AUTHOR_QUALIFIER_PATTERN = /^(?:외전|본편|특별|개정|완결|연재|시즌|season|파트|part|합본|단행본|에디션|edition|리마스터|리메이크|상권|하권|상편|하편)$/iu;
const PLATFORM_QUALIFIER_PATTERN = /^(?:19N|N|P|일반|성인|문피아|조아라|노벨피아|타입문넷|카카오페이지|네이버시리즈|리디|리디북스)$/iu;
const AUTHOR_NOISE_EXACT = new Set([
    'txt', 'text', '미결', '구버전', '무료끝', '작품후기 제거', '후기', '에필로그',
    '에필 및 후기', '외전', '본편', '시즌1', '1부', '1, 2, 3부', 'ㅎㅅㅇ'
].map((value) => value.normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/\s+/gu, ' ').trim()));
function isProbableAuthorNoise(value) {
    const normalized = value.normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/\s+/gu, ' ').trim();
    if (AUTHOR_NOISE_EXACT.has(normalized))
        return true;
    if (/^(?:외전|번외|에필(?:로그)?|후기|시즌)\s*\d{1,7}$/iu.test(normalized))
        return true;
    if (/^\d{1,7}\s*(?:화|회|편|장|권|부)(?:\s*(?:까지|완결|완|完))?$/iu.test(normalized))
        return true;
    if (/^\d{1,4}(?:\s*[,/]\s*\d{1,4})*\s*부(?:\s*(?:완결|완|完))?(?:[.\s-]*(?:(?:19|20)?\d{4,8}|리메이크))?$/iu.test(normalized))
        return true;
    if (/^(?:작업|공금|갠소|배포|업로드|정리|스캔|텍본)(?:\s|$)/iu.test(normalized))
        return true;
    if (/^(?:무료|유료)(?:끝|분|공개)?$/iu.test(normalized))
        return true;
    return false;
}
function compactWhitespace(value) {
    return value.replace(/[\u00a0\u2000-\u200b\u202f\u205f\u3000]+/gu, ' ').replace(/\s+/g, ' ').trim();
}
function normalizeRaw(value) {
    return compactWhitespace(value.replace(/ⓒ/gu, '©').normalize('NFKC').replace(/\++/gu, ' '));
}
function stripExtension(value) {
    return value.replace(/(?:\.(?:txt|text))+$/iu, '');
}
function stripCopySuffix(value) {
    let output = value;
    for (let index = 0; index < 4; index += 1) {
        const next = output
            .replace(/\s*[[(（]\s*\d{1,3}\s*[\])）]\s*$/u, '')
            .replace(/\s*[-_]\s*0?1\s*$/u, '')
            .replace(/\s+(?:작업완료|공금|업로드용|배포용)\s*$/iu, '');
        if (next === output)
            break;
        output = next;
    }
    return compactWhitespace(output);
}
function normalizeCandidateKey(value) {
    return value.normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/[^\p{L}\p{N}]+/gu, '');
}
function cleanAuthor(value) {
    let author = stripCopySuffix(normalizeRaw(value))
        .replace(new RegExp(`^${AUTHOR_PREFIX}\\s*[:：]?\\s*`, 'iu'), '')
        .replace(/^[\-–—|/@©ⓒ]+|[\-–—|/@©ⓒ]+$/gu, '')
        .trim();
    for (let index = 0; index < 4; index += 1) {
        const qualifier = author.match(/\s*[[(（]\s*([^\])）]{1,30})\s*[\])）]\s*$/u);
        if (!qualifier || !PLATFORM_QUALIFIER_PATTERN.test(compactWhitespace(qualifier[1] ?? '')))
            break;
        author = author.slice(0, Math.max(0, author.length - qualifier[0].length)).trim();
    }
    author = author.replace(new RegExp(String.raw `\s*(?:${RELEASE_WORD}|${RANGE}|\d{1,7}\s*${ANY_UNIT})[\s\p{P}]*$`, 'iu'), '').trim();
    const wrapped = author.match(/^[[(（{【]\s*([^\])）}】]{1,40})\s*[\])）}】]$/u);
    if (wrapped)
        author = compactWhitespace(wrapped[1] ?? '');
    if (author.length < 1 || author.length > 40)
        return null;
    if (NOISE_TAG_PATTERN.test(author) || AUTHOR_QUALIFIER_PATTERN.test(author) || isProbableAuthorNoise(author))
        return null;
    const handleLike = /^_[A-Za-z0-9_]{1,39}$/u.test(author) || /^\d{1,8}_[A-Za-z0-9_]{1,30}$/u.test(author);
    if (/^[\p{P}\p{S}\p{Z}\d_]+$/u.test(author) && !handleLike)
        return null;
    if (!/[\p{L}\p{N}]/u.test(author) || /[<>{}:：/\\]/u.test(author))
        return null;
    return author;
}
function genreAuthorFromBracket(value) {
    const parts = value.split(/[,/|]/u).map((item) => compactWhitespace(item)).filter(Boolean);
    if (parts.length > 1 && parts.slice(0, -1).every((item) => NOISE_TAG_PATTERN.test(item))) {
        return cleanAuthor(parts.at(-1) ?? '');
    }
    return cleanAuthor(value);
}
function stripEdgeNoiseTags(value) {
    let current = value;
    const bracketAtStart = /^\s*[[(（{<【]\s*([^\])）}>】]{1,60})\s*[\])）}>】]\s*/u;
    const bracketAtEnd = /\s*[[(（{<【]\s*([^\])）}>】]{1,60})\s*[\])）}>】]\s*$/u;
    for (let index = 0; index < 10; index += 1) {
        const start = current.match(bracketAtStart);
        if (start && NOISE_TAG_PATTERN.test(compactWhitespace(start[1] ?? ''))) {
            current = current.slice(start[0].length);
            continue;
        }
        const end = current.match(bracketAtEnd);
        const endText = compactWhitespace(end?.[1] ?? '');
        if (end && (NOISE_TAG_PATTERN.test(endText) || new RegExp(String.raw `(?:${COMPLETE}|외전|후기|포함)`, 'iu').test(endText))) {
            current = current.slice(0, Math.max(0, current.length - end[0].length));
            continue;
        }
        break;
    }
    return current;
}
function canStripToPrefix(prefix) {
    const letters = prefix.match(/[\p{L}]/gu)?.length ?? 0;
    return letters >= 2 || /^[\p{Script=Hangul}\p{Script=Han}](?:\([\p{Script=Han}]{1,4}\))?$/u.test(prefix.trim());
}
function stripPatternIfTitleRemains(value, pattern) {
    const match = value.match(pattern);
    if (!match || match.index === undefined)
        return { value, removed: false };
    const prefix = value.slice(0, match.index).replace(/[\s\-–—|/:：·,+]+$/gu, '');
    if (!canStripToPrefix(prefix))
        return { value, removed: false };
    return { value: prefix, removed: true };
}
function stripTrailingReleaseNoise(value) {
    let output = stripCopySuffix(stripEdgeNoiseTags(normalizeRaw(value)));
    let removed = output !== value;
    const trailingDecor = String.raw `(?:\s|[,.;:/|+]|[[(（{<【][^\])）}>】]{0,80}[\])）}>】]|${RELEASE_WORD}|(?:[A-Z]{1,3}|Mu)|\d{1,4}\s*(?:화|회|편|장|권|부))*`;
    const patterns = [
        new RegExp(String.raw `(?:\s|(?<=[\p{L}\])）]))(?:(?:prol(?:ogue)?\.?|프롤로그)\s*[-.]?\s*)?\d{1,7}\s*(?:${ANY_UNIT})?\s*[-~～–—]\s*\d{1,7}\s*(?:${ANY_UNIT})?${trailingDecor}$`, 'iu'),
        new RegExp(String.raw `(?:\s|(?<=[\p{L}\])）]))\d{1,7}\s+\d{1,7}\s*(?:${ANY_UNIT})?${trailingDecor}$`, 'iu'),
        new RegExp(String.raw `\s+-\s*\d{1,7}${trailingDecor}$`, 'iu'),
        new RegExp(String.raw `\s+\d{1,7}\s*(?:${EPISODE_UNIT}|${STANDALONE_VOLUME_UNIT})${trailingDecor}$`, 'iu'),
        new RegExp(String.raw `\s+\d{1,7}\s*${VOLUME_UNIT}\s*(?:${COMPLETE}|외전|후기|포함)${trailingDecor}$`, 'iu'),
        new RegExp(String.raw `\s+\d{1,7}\s*(?:${COMPLETE})${trailingDecor}$`, 'iu'),
        new RegExp(String.raw `\s+(?:본편|외전|번외|에필(?:로그)?|후기)(?:\s*\+?\s*(?:외전|번외|에필(?:로그)?|후기|\d{1,7}\s*(?:${ANY_UNIT})?))*${trailingDecor}$`, 'iu'),
        new RegExp(String.raw `(?<=[^\d\s])\d{1,7}\s*[-~～–—]\s*\d{1,7}\s*(?:${ANY_UNIT})?${trailingDecor}$`, 'iu'),
        new RegExp(String.raw `(?<=[\p{L}\])）}])\d{1,4}\s*(?:${STANDALONE_VOLUME_UNIT}|장)${trailingDecor}$`, 'iu'),
        new RegExp(String.raw `(?<=[\p{L}\])）}])\d{1,4}\s*[,，]\s*\d{1,4}\s*(?:${STANDALONE_VOLUME_UNIT}|장)${trailingDecor}$`, 'iu'),
        new RegExp(String.raw `\s*[-~～–—]\s*\d{1,7}${trailingDecor}$`, 'iu'),
        new RegExp(String.raw `\s+총\s*\d{1,7}\s*(?:${ANY_UNIT})${trailingDecor}$`, 'iu'),
        /\s+\d{1,7}\s*$/u
    ];
    for (let pass = 0; pass < 12; pass += 1) {
        const before = output;
        output = stripCopySuffix(stripEdgeNoiseTags(output));
        output = output.replace(new RegExp(String.raw `\s*(?:${RELEASE_WORD})\s*$`, 'iu'), '').trim();
        output = stripEdgeNoiseTags(output);
        for (const pattern of patterns) {
            const stripped = stripPatternIfTitleRemains(output, pattern);
            if (stripped.removed) {
                output = stripped.value;
                removed = true;
                break;
            }
        }
        output = output.replace(/[\s\-–—|/:：·,+]+$/gu, '');
        if (output === before)
            break;
        removed = true;
    }
    return { value: compactWhitespace(output), removed };
}
function extractExplicitAuthor(value) {
    const raw = stripCopySuffix(stripExtension(normalizeRaw(value)));
    for (const marker of ['@', 'ⓒ', '©']) {
        const markerIndex = raw.lastIndexOf(marker);
        if (markerIndex > 0 && raw.length - markerIndex <= 120) {
            const title = raw.slice(0, markerIndex).trim();
            const authorRaw = raw.slice(markerIndex + marker.length).trim();
            const author = cleanAuthor(stripTrailingReleaseNoise(authorRaw).value);
            if (title)
                return { title, author };
        }
    }
    const directPatterns = [
        new RegExp(String.raw `\s*[[(（{]\s*${AUTHOR_PREFIX}\s*[:：]?\s*([^\])）}]{1,40})\s*[\])）}]\s*$`, 'iu'),
        new RegExp(String.raw `\s+(?:[-–—|/]\s*)${AUTHOR_PREFIX}\s*[:：]?\s*([^/\\()[\]{}]{1,40})\s*$`, 'iu')
    ];
    for (const pattern of directPatterns) {
        const match = raw.match(pattern);
        if (!match || match.index === undefined)
            continue;
        const author = cleanAuthor(match[1] ?? '');
        if (author)
            return { title: raw.slice(0, match.index).trim(), author };
    }
    const terminalNoiseRemoved = raw.replace(new RegExp(String.raw `\s*(?:${COMPLETE}|작업완료|공금|#?ex)\s*$`, 'iu'), '').trim();
    const suffix = terminalNoiseRemoved.match(/\s*[[(（{【]\s*([^\])）}】]{1,50})\s*[\])）}】]\s*$/u);
    if (suffix?.index !== undefined) {
        const author = genreAuthorFromBracket(suffix[1] ?? '');
        if (author && [...author].length >= 2 && !NOISE_TAG_PATTERN.test(compactWhitespace(suffix[1] ?? ''))) {
            return { title: terminalNoiseRemoved.slice(0, suffix.index).trim(), author };
        }
    }
    const dashAuthor = raw.match(/\s+[-–—]\s*([^\d/\\()[\]{}]{1,40})\s*$/u);
    if (dashAuthor?.index !== undefined && new RegExp(String.raw `(?:${RANGE}|${COMPLETE}|\[[^\]]+\])`, 'iu').test(raw.slice(0, dashAuthor.index))) {
        const author = cleanAuthor(dashAuthor[1] ?? '');
        if (author)
            return { title: raw.slice(0, dashAuthor.index).trim(), author };
    }
    const plainAuthor = raw.match(new RegExp(String.raw `(?:${COMPLETE}|외전|후기|포함)[\s,]+([\p{L}][\p{L}\p{N}_.-]{0,39})\s*$`, 'iu'));
    if (plainAuthor?.index !== undefined) {
        const author = cleanAuthor(plainAuthor[1] ?? '');
        if (author)
            return { title: raw.slice(0, plainAuthor.index + (plainAuthor[0].length - (plainAuthor[1]?.length ?? 0))).trim(), author };
    }
    return { title: raw, author: null };
}
function plausibleBareAuthor(value) {
    const author = genreAuthorFromBracket(value);
    if (!author)
        return null;
    const words = author.split(/\s+/u);
    if (words.length > 3)
        return null;
    if (words.length === 1 && author.length > 20)
        return null;
    return author;
}
function extractBareBracketAuthor(value) {
    const raw = stripCopySuffix(stripExtension(normalizeRaw(value)));
    const stripped = stripTrailingReleaseNoise(raw);
    const target = stripped.value;
    const suffix = target.match(/\s*[[(（{【]\s*([^\])）}】]{1,50})\s*[\])）}】]\s*$/u);
    if (suffix?.index !== undefined) {
        const author = plausibleBareAuthor(suffix[1] ?? '');
        const title = target.slice(0, suffix.index).trim();
        if (author && [...author].length >= 2 && title && !NOISE_TAG_PATTERN.test(compactWhitespace(suffix[1] ?? '')))
            return { title, author };
    }
    const prefix = target.match(/^\s*[[(（{【]\s*([^\])）}】]{1,50})\s*[\])）}】]\s*/u);
    if (prefix) {
        const author = plausibleBareAuthor(prefix[1] ?? '');
        const title = target.slice(prefix[0].length).trim();
        if (author && [...author].length >= 2 && title && (stripped.removed || title.length >= 4) && !NOISE_TAG_PATTERN.test(compactWhitespace(prefix[1] ?? '')))
            return { title, author };
    }
    return null;
}
function sourcePathParts(sourceKey, sourceKind) {
    let value = sourceKey.replace(/ⓒ/gu, '©').normalize('NFKC').replace(/\\/g, '/').trim();
    if (!value)
        return { filename: null, folders: [] };
    if (value.startsWith('prefix:')) {
        value = value.slice('prefix:'.length);
        const finalSeparator = value.lastIndexOf(':');
        if (finalSeparator >= 0)
            value = value.slice(0, finalSeparator);
    }
    const segments = value.split('/').map((item) => item.trim()).filter(Boolean);
    if (!segments.length)
        return { filename: null, folders: [] };
    const last = segments.at(-1) ?? '';
    const hasTextExtension = /(?:\.(?:txt|text))+$/iu.test(last);
    const filename = hasTextExtension || sourceKind === 'single' ? last : null;
    const folderSegments = filename ? segments.slice(0, -1) : segments;
    return { filename, folders: folderSegments.reverse() };
}
function stripScopeSuffix(value, folders) {
    let output = value;
    const pathScope = output.match(/\s*\(([^()]{1,240})\)\s*$/u);
    if (pathScope?.index !== undefined) {
        const parts = (pathScope[1] ?? '').split(/[\\/]/u).map((part) => compactWhitespace(part)).filter(Boolean);
        if (parts.length >= 2 && parts.every((part) => isGenericFolder(part))) {
            output = output.slice(0, pathScope.index).trim();
        }
    }
    for (const folder of folders.slice(0, 4)) {
        const escaped = folder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        output = output.replace(new RegExp(String.raw `\s*\(\s*${escaped}\s*\)\s*$`, 'iu'), '');
    }
    return output;
}
function cleanMetadataSearchTitle(value, folders = []) {
    const explicit = extractExplicitAuthor(value);
    let output = stripScopeSuffix(explicit.title, folders);
    output = stripTrailingReleaseNoise(output).value;
    output = stripEdgeNoiseTags(output);
    output = output.replace(/[_＿]+/gu, ' ');
    return compactWhitespace(output).slice(0, 300);
}
function isEpisodeOnlyTitle(value) {
    const normalized = compactWhitespace(value.normalize('NFKC'));
    return new RegExp(String.raw `^(?:\d{1,7}|(?:제\s*)?\d{1,7}\s*${ANY_UNIT}|(?:프롤로그|에필로그|서장|종장|외전|번외)(?:\s*\d{1,4})?)$`, 'iu').test(normalized);
}
function isGenericFolder(value) {
    const normalized = normalizeCandidateKey(value);
    if (GENERIC_FOLDER_NAMES.has(normalized))
        return true;
    if (/^(?:19|20)?\d{2}(?:년)?$/u.test(normalized))
        return true;
    if (/^(?:19|20)?\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])?$/u.test(normalized))
        return true;
    if (/^(?:[ㄱ-ㅎㅏ-ㅣ]|[ᄀ-ᇿ])$/u.test(normalized))
        return true;
    if (/^[a-z]\d?$/iu.test(normalized))
        return true;
    if (/^\d{1,8}$/u.test(normalized))
        return true;
    return false;
}
function isUsefulTitle(value, source) {
    const title = compactWhitespace(value);
    if (!title.length || title.length > 200)
        return false;
    if (title.length < 2 && !/^[\p{Script=Hangul}\p{Script=Han}]$/u.test(title))
        return false;
    if (!/[\p{L}]/u.test(title) || isEpisodeOnlyTitle(title))
        return false;
    if (!normalizeCandidateKey(title))
        return false;
    if (source === 'folder' && isGenericFolder(title))
        return false;
    return true;
}
function titleScore(value, base) {
    let score = base;
    if (value.length >= 4 && value.length <= 80)
        score += 4;
    if (/[@\\/]/u.test(value))
        score -= 24;
    if (new RegExp(String.raw `(?:${RANGE}|\d{1,7}\s*${ANY_UNIT})\s*$`, 'iu').test(value))
        score -= 18;
    if (/^[[(（{].+[\])）}]$/u.test(value))
        score -= 10;
    return score;
}
function deriveMetadataSearchCandidates(canonicalTitle, sourceKey = '', knownAuthor = null, sourceKind = '') {
    const pathParts = sourcePathParts(sourceKey, sourceKind);
    const drafts = [];
    const known = cleanAuthor(knownAuthor ?? '');
    const addPrepared = (rawTitle, rawAuthor, source, baseScore) => {
        const title = cleanMetadataSearchTitle(rawTitle, pathParts.folders);
        if (!isUsefulTitle(title, source))
            return;
        drafts.push({ title, author: known ?? rawAuthor, source, score: titleScore(title, baseScore) });
    };
    const add = (raw, source, baseScore, allowBareAuthor) => {
        if (!raw)
            return;
        const normalizedRaw = stripCopySuffix(stripExtension(normalizeRaw(raw)));
        const withoutPathScope = stripScopeSuffix(normalizedRaw, pathParts.folders);
        const explicit = extractExplicitAuthor(withoutPathScope);
        const markerSeparated = /[@©ⓒ]/u.test(withoutPathScope) && explicit.title !== withoutPathScope;
        if (explicit.author || markerSeparated) {
            addPrepared(explicit.title, explicit.author, source, baseScore + (explicit.author ? 5 : 2));
            return;
        }
        if (allowBareAuthor) {
            const bare = extractBareBracketAuthor(withoutPathScope);
            if (bare) {
                addPrepared(bare.title, bare.author, source, baseScore + 4);
                addPrepared(withoutPathScope, null, source, baseScore - 16);
                return;
            }
        }
        addPrepared(explicit.title, null, source, baseScore);
    };
    const explicitSource = sourceKind === 'manual' || sourceKind === 'metadata';
    const canonicalBase = explicitSource ? 130 : sourceKind === 'folder' ? 118 : 106;
    add(canonicalTitle, 'canonical', canonicalBase, !explicitSource);
    if (!explicitSource) {
        if (pathParts.filename)
            add(pathParts.filename, 'filename', sourceKind === 'single' ? 122 : 102, true);
        pathParts.folders.slice(0, 4).forEach((folder, index) => add(folder, 'folder', 106 - index * 14, true));
    }
    const propagatedAuthor = known ?? drafts.find((candidate) => candidate.author)?.author ?? null;
    const byTitle = new Map();
    for (const candidate of drafts) {
        const key = normalizeCandidateKey(candidate.title);
        const next = { ...candidate, author: candidate.author ?? propagatedAuthor };
        const existing = byTitle.get(key);
        if (!existing || next.score > existing.score || (!existing.author && next.author))
            byTitle.set(key, next);
    }
    const ranked = [...byTitle.values()]
        .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title, 'ko-KR'))
        .slice(0, 4);
    if (ranked.length)
        return ranked;
    const fallback = compactWhitespace(stripExtension(canonicalTitle.normalize('NFKC'))).slice(0, 300);
    return fallback ? [{ title: fallback, author: known, source: 'canonical', score: 0 }] : [];
}
function deriveMetadataSearchTerms(canonicalTitle, sourceKey = '', knownAuthor = null, sourceKind = '') {
    const candidate = deriveMetadataSearchCandidates(canonicalTitle, sourceKey, knownAuthor, sourceKind)[0];
    return candidate ? { title: candidate.title, author: candidate.author } : { title: compactWhitespace(canonicalTitle), author: knownAuthor };
}
const SEARCH_PARTICLE_SUFFIX = /(?:은|는|이|가|을|를|의|에|에서|로|으로|와|과|도|만|까지|부터)$/u;
/**
 * Public Korean web-novel search pages do not always return an exact long-title
 * query even when a shorter prefix finds the same work. Keep the canonical title
 * as the matching target, but provide at most two conservative fallback queries.
 */
function deriveMetadataSearchQueryVariants(title) {
    const normalized = compactWhitespace(title.normalize('NFKC'));
    if (!normalized)
        return [];
    const variants = [];
    const keys = new Set();
    const add = (value) => {
        const candidate = compactWhitespace(value.replace(/[\s\-–—|/:：·,+]+$/gu, ''));
        const key = normalizeCandidateKey(candidate);
        if (!key || candidate.length < 2 || keys.has(key))
            return;
        keys.add(key);
        variants.push(candidate.slice(0, 200));
    };
    add(normalized);
    const words = normalized.split(/\s+/u).filter(Boolean);
    if (words.length >= 3) {
        const prefix = words.slice(0, -1);
        add(prefix.join(' '));
        const last = prefix.at(-1) ?? '';
        const particleTrimmed = last.length >= 2 ? last.replace(SEARCH_PARTICLE_SUFFIX, '') : last;
        if (particleTrimmed && particleTrimmed !== last)
            add([...prefix.slice(0, -1), particleTrimmed].join(' '));
        else
            add(words.slice(0, 2).join(' '));
    }
    else if (words.length === 2) {
        const first = words[0] ?? '';
        if (first.length >= 3)
            add(first);
    }
    return variants.slice(0, 3);
}
