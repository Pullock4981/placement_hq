// GitHub Profile Check (60 Marks Deterministic Evaluator Engine)
// 100% Deterministic, 0% AI Tokens, Dual-fetching Architecture

export interface GithubCriterionResult {
  id: string;
  name: string;
  nameBangla: string;
  maxScore: number;
  score: number;
  passed: boolean;
  status: 'passed' | 'partial' | 'failed';
  details: string;
  recommendation?: string;
}

export interface RawGithubProfile {
  login: string;
  name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  location?: string | null;
  email?: string | null;
  blog?: string | null;
  twitter_username?: string | null;
  public_repos: number;
}

export interface RawGithubRepo {
  name: string;
  description?: string | null;
  homepage?: string | null;
  language?: string | null;
  topics?: string[];
  html_url?: string;
}

export interface FetchedGithubData {
  username: string;
  profile: RawGithubProfile;
  repos: RawGithubRepo[];
  profileReadmeText: string;
  repoReadmeTexts: Record<string, string>;
  fetchedVia: 'api' | 'scraper-cdn' | 'hybrid';
}

export interface GithubEvaluationResult {
  username: string;
  profileUrl: string;
  avatarUrl: string;
  name: string;
  bio: string;
  location: string;
  publicReposCount: number;
  hasProfileReadme: boolean;
  totalScore: number; // Max 60
  percentage: number; // (totalScore / 60) * 100
  grade: 'Excellent Profile' | 'Strong Profile' | 'Moderate Profile' | 'Needs Improvement';
  gradeBangla: string;
  criteria: Record<string, GithubCriterionResult>;
  criteriaList: GithubCriterionResult[];
  recommendations: string[];
  repoSummary: {
    totalChecked: number;
    reposWithDescription: number;
    reposWithLiveDemo: number;
    reposWithReadme: number;
    topLanguages: string[];
  };
  fetchedVia: 'api' | 'scraper-cdn' | 'hybrid';
}

/**
 * Extract GitHub username from a link, profile URL, or raw string.
 */
export function extractGithubUsername(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  // If it's a URL like https://github.com/username or github.com/username
  const urlMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_\-\.]+)/i);
  if (urlMatch && urlMatch[1]) {
    const rawUser = urlMatch[1].replace(/^@/, '').replace(/\/+$/, '');
    if (rawUser && !['login', 'signup', 'features', 'topics', 'explore', 'orgs'].includes(rawUser.toLowerCase())) {
      return rawUser;
    }
  }
  // Plain username or @username
  const clean = trimmed.replace(/^@/, '').replace(/\/+$/, '').split('/')[0].split('?')[0];
  return clean.trim();
}

/**
 * Fetch raw text from GitHub CDN across main/master/dev branches and capitalization variants.
 */
async function fetchRawReadme(username: string, repo: string): Promise<string> {
  const branches = ['main', 'master', 'dev', 'develop'];
  const filenames = ['README.md', 'readme.md', 'Readme.md', 'README', 'readme'];

  for (const branch of branches) {
    for (const filename of filenames) {
      try {
        const url = `https://raw.githubusercontent.com/${username}/${repo}/${branch}/${filename}`;
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
            'Accept': 'text/plain,text/markdown,*/*',
          },
          cache: 'no-store',
        });
        if (res.ok) {
          const text = await res.text();
          if (text && !text.trim().startsWith('<!DOCTYPE html>') && text.trim().length > 10) {
            return text;
          }
        }
      } catch {
        // Continue fallback
      }
    }
  }
  return '';
}

/**
 * Scrapes GitHub user profile HTML, including Pinned Repositories with their descriptions & languages.
 */
async function scrapeGithubWebProfile(username: string): Promise<{ profile: RawGithubProfile; repos: RawGithubRepo[] }> {
  try {
    const url = `https://github.com/${username}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      return {
        profile: { login: username, public_repos: 0 },
        repos: [],
      };
    }

    const html = await res.text();

    // 1. Avatar URL
    let avatarUrl = '';
    const avatarMatch = html.match(/class="[^"]*avatar[^"]*"[^>]*src="([^"]+)"/i) ||
                        html.match(/src="([^"]+)"[^>]*class="[^"]*avatar/i);
    if (avatarMatch && avatarMatch[1]) {
      avatarUrl = avatarMatch[1].replace(/&amp;/g, '&');
    }

    // 2. Name
    let name = '';
    const nameMatch = html.match(/itemprop="name"[^>]*>([^<]+)</i) ||
                      html.match(/class="[^"]*vcard-fullname[^"]*"[^>]*>([^<]+)</i);
    if (nameMatch && nameMatch[1]) {
      name = nameMatch[1].trim();
    }

    // 3. Bio
    let bio = '';
    const bioMatch = html.match(/class="[^"]*user-profile-bio[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    if (bioMatch && bioMatch[1]) {
      bio = bioMatch[1].replace(/<[^>]+>/g, '').trim();
    }

    // 4. Location
    let location = '';
    const locMatch = html.match(/itemprop="homeLocation"[^>]*>([\s\S]*?)<\/li>/i) ||
                     html.match(/data-test-selector="profile-location"[^>]*>([\s\S]*?)<\/span>/i);
    if (locMatch && locMatch[1]) {
      location = locMatch[1].replace(/<[^>]+>/g, '').trim();
    }

    // 5. Email
    let email = '';
    const emailMatch = html.match(/itemprop="email"[^>]*>([\s\S]*?)<\/a>/i);
    if (emailMatch && emailMatch[1]) {
      email = emailMatch[1].replace(/<[^>]+>/g, '').trim();
    }

    // 6. Blog / Website
    let blog = '';
    const blogMatch = html.match(/itemprop="url"[^>]*>([\s\S]*?)<\/a>/i);
    if (blogMatch && blogMatch[1]) {
      blog = blogMatch[1].replace(/<[^>]+>/g, '').trim();
    }

    // 7. Repositories count
    let publicRepos = 0;
    const reposCounterMatch = html.match(/data-tab-item="repositories"[^>]*>[\s\S]*?class="Counter"[^>]*>([^<]+)</i) ||
                              html.match(/Repositories[\s\S]*?class="Counter"[^>]*>([^<]+)</i);
    if (reposCounterMatch && reposCounterMatch[1]) {
      const parsed = parseInt(reposCounterMatch[1].replace(/,/g, '').trim(), 10);
      if (!isNaN(parsed)) publicRepos = parsed;
    }

    // 8. Pinned & Public Repositories (with Descriptions & Languages)
    const repos: RawGithubRepo[] = [];
    const seenNames = new Set<string>();

    // A. Parse Pinned Items (Pinned section in profile)
    const pinnedBlockRegex = /(?:class="[^"]*pinned-item-list-item[^"]*"|<div class="pinned-item-list-item-content">)([\s\S]*?)(?:<\/li>|<\/div>\s*<\/div>\s*<\/li>|<div class="pinned-item-list-item-content">|$)/gi;
    let pMatch: RegExpExecArray | null;
    while ((pMatch = pinnedBlockRegex.exec(html)) !== null) {
      const block = pMatch[1];
      const nameMatch = block.match(/class="repo"[^>]*>([^<]+)</i) ||
                        block.match(/href="\/[^\/]+\/([^\/"]+)"[^>]*class="[^"]*text-bold/i) ||
                        block.match(/itemprop="name codeRepository"[^>]*>([^<]+)</i);
      if (nameMatch && nameMatch[1]) {
        const repoName = nameMatch[1].trim();
        if (repoName && !seenNames.has(repoName.toLowerCase())) {
          seenNames.add(repoName.toLowerCase());
          let description = '';
          const descMatch = block.match(/class="[^"]*pinned-item-desc[^"]*"[^>]*>([\s\S]*?)<\/p>/i) ||
                            block.match(/itemprop="description"[^>]*>([\s\S]*?)<\/p>/i);
          if (descMatch && descMatch[1]) {
            description = descMatch[1].replace(/<[^>]+>/g, '').trim();
          }

          let language = '';
          const langMatch = block.match(/itemprop="programmingLanguage"[^>]*>([^<]+)</i);
          if (langMatch && langMatch[1]) {
            language = langMatch[1].trim();
          }

          repos.push({
            name: repoName,
            description: description || null,
            language: language || null,
            homepage: null,
          });
        }
      }
    }

    // B. Parse other public repositories listed with itemprop="name codeRepository"
    const generalRepoRegex = /itemprop="name codeRepository"[^>]*>([^<]+)<\/a>[\s\S]*?(?:itemprop="description"[^>]*>([\s\S]*?)<\/p>)?/gi;
    let gMatch: RegExpExecArray | null;
    while ((gMatch = generalRepoRegex.exec(html)) !== null) {
      const rName = gMatch[1].trim();
      if (rName && !seenNames.has(rName.toLowerCase())) {
        seenNames.add(rName.toLowerCase());
        const rDesc = gMatch[2] ? gMatch[2].replace(/<[^>]+>/g, '').trim() : '';
        repos.push({
          name: rName,
          description: rDesc || null,
          language: null,
          homepage: null,
        });
      }
    }

    return {
      profile: {
        login: username,
        name: name || null,
        avatar_url: avatarUrl || null,
        bio: bio || null,
        location: location || null,
        email: email || null,
        blog: blog || null,
        public_repos: publicRepos || repos.length,
      },
      repos,
    };
  } catch {
    return {
      profile: { login: username, public_repos: 0 },
      repos: [],
    };
  }
}

/**
 * Dual Fetching Data Architecture:
 * 1. Primary: Official GitHub REST API.
 * 2. Rate limit fallback: Live GitHub Web HTML Scraper + Raw GitHub CDN.
 */
export async function fetchGithubData(rawUsernameOrLink: string): Promise<FetchedGithubData> {
  const username = extractGithubUsername(rawUsernameOrLink);
  if (!username) {
    throw new Error('Valid GitHub username not found.');
  }

  const apiHeaders: Record<string, string> = {
    'User-Agent': 'PH-PlacementHQ-GitHubEvaluator/1.0',
    'Accept': 'application/vnd.github.v3+json',
  };
  if (process.env.GITHUB_TOKEN) {
    apiHeaders['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  let profile: RawGithubProfile | null = null;
  let repos: RawGithubRepo[] = [];
  let fetchedVia: 'api' | 'scraper-cdn' | 'hybrid' = 'api';

  // Step 1: Try GitHub REST API
  try {
    const userRes = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, {
      headers: apiHeaders,
      cache: 'no-store',
    });

    if (userRes.ok) {
      profile = (await userRes.json()) as RawGithubProfile;

      // Fetch Top Repositories
      try {
        const repoRes = await fetch(
          `https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=10`,
          { headers: apiHeaders, cache: 'no-store' },
        );
        if (repoRes.ok) {
          repos = (await repoRes.json()) as RawGithubRepo[];
        }
      } catch {
        // Fallback for repos
      }
    } else if (userRes.status === 403 || userRes.status === 429) {
      fetchedVia = 'scraper-cdn';
    }
  } catch {
    fetchedVia = 'scraper-cdn';
  }

  // Step 2: Always scrape profile HTML to capture Pinned items and their descriptions/languages!
  try {
    const scraped = await scrapeGithubWebProfile(username);
    if (!profile) {
      profile = scraped.profile;
      repos = scraped.repos;
      fetchedVia = 'scraper-cdn';
    } else if (scraped.repos.length > 0) {
      // Merge pinned repos at front of repos list
      for (const sRepo of scraped.repos) {
        const existing = repos.find((r) => r.name.toLowerCase() === sRepo.name.toLowerCase());
        if (existing) {
          if (!existing.description && sRepo.description) {
            existing.description = sRepo.description;
          }
          if (!existing.language && sRepo.language) {
            existing.language = sRepo.language;
          }
        } else {
          repos.unshift(sRepo);
        }
      }
      fetchedVia = 'hybrid';
    }
  } catch {}

  if (!profile) {
    profile = { login: username, public_repos: 0 };
  }

  // Step 3: Fetch Profile README from Raw CDN ({username}/{username})
  const profileReadmeText = await fetchRawReadme(username, username);

  // Step 4: Fetch Repository READMEs for top repositories (up to 6 repos, prioritizing pinned!)
  const repoReadmeTexts: Record<string, string> = {};
  const reposToCheck = repos.slice(0, 6);
  for (const repo of reposToCheck) {
    if (repo.name && repo.name.toLowerCase() !== username.toLowerCase()) {
      let readme = '';
      // Try GitHub API first if token is available
      if (process.env.GITHUB_TOKEN) {
        try {
          const apiReadmeRes = await fetch(
            `https://api.github.com/repos/${encodeURIComponent(username)}/${encodeURIComponent(repo.name)}/readme`,
            { headers: apiHeaders, cache: 'no-store' },
          );
          if (apiReadmeRes.ok) {
            const readmeData = await apiReadmeRes.json();
            if (readmeData.content && readmeData.encoding === 'base64') {
              readme = Buffer.from(readmeData.content, 'base64').toString('utf-8');
            }
          }
        } catch {}
      }

      // If not fetched via API, fetch via Raw GitHub CDN across branches
      if (!readme) {
        readme = await fetchRawReadme(username, repo.name);
      }

      if (readme) {
        repoReadmeTexts[repo.name] = readme;
      }
    }
  }

  return {
    username,
    profile,
    repos,
    profileReadmeText,
    repoReadmeTexts,
    fetchedVia,
  };
}

/**
 * GitHub Profile Evaluator (60 Marks Master Rubric)
 * Evaluates 15 criteria deterministically.
 */
export function evaluateGithubProfile(data: FetchedGithubData): GithubEvaluationResult {
  const { username, profile, repos, profileReadmeText, repoReadmeTexts, fetchedVia } = data;
  const criteria: Record<string, GithubCriterionResult> = {};
  const recommendations: string[] = [];

  const profileReadmeLower = (profileReadmeText || '').toLowerCase();
  const bioLower = (profile.bio || '').toLowerCase();
  const allRepoReadmesCombined = Object.values(repoReadmeTexts).join('\n\n').toLowerCase();

  // -------------------------------------------------------------
  // 1. Professional Profile Image (6 Marks)
  // , /
  // -------------------------------------------------------------
  const avatarUrl = profile.avatar_url || '';
  const isIdenticon =
    !avatarUrl ||
    avatarUrl.includes('identicons') ||
    avatarUrl.includes('d=identicon') ||
    avatarUrl.includes('avatar_user_default') ||
    avatarUrl.includes('github/images/modules/logos_page');

  const avatarScore = !isIdenticon && avatarUrl.length > 5 ? 6 : 0;
  criteria['profile_image'] = {
    id: 'profile_image',
    name: 'Professional Profile Image',
    nameBangla: 'Professional Profile Image',
    maxScore: 6,
    score: avatarScore,
    passed: avatarScore === 6,
    status: avatarScore === 6 ? 'passed' : 'failed',
    details: avatarScore === 6
      ? 'Custom profile photo is uploaded.'
      : 'Default or identicon avatar detected.',
    recommendation: avatarScore === 0 ? 'Upload a clear, smiling and professional headshot profile photo on GitHub.' : undefined,
  };
  if (avatarScore === 0) recommendations.push('Upload a professional custom photo to your GitHub profile.');

  // -------------------------------------------------------------
  // 2. Current Location Listed (2 Marks)
  // ,
  // -------------------------------------------------------------
  const hasLocation = Boolean(profile.location && profile.location.trim().length > 1);
  const locationScore = hasLocation ? 2 : 0;
  criteria['location'] = {
    id: 'location',
    name: 'Current Location Listed',
    nameBangla: 'Current Location Listed',
    maxScore: 2,
    score: locationScore,
    passed: locationScore === 2,
    status: locationScore === 2 ? 'passed' : 'failed',
    details: hasLocation
      ? `Location listed (${profile.location}).`
      : 'No location listed on profile.',
    recommendation: locationScore === 0 ? 'Go to profile settings and add your current location (e.g., Dhaka, Bangladesh).' : undefined,
  };
  if (locationScore === 0) recommendations.push('Add current location (e.g., Dhaka, Bangladesh) in your profile settings.');

  // -------------------------------------------------------------
  // 3. Email & Contact Info (2 Marks)
  // README-       ,
  // -------------------------------------------------------------
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i;
  const phoneRegex = /(?:\+?880|01|\+?\d{1,3}[-.\s]?)?\d{9,11}/;

  const hasPublicEmail = Boolean(
    profile.email ||
    emailRegex.test(profile.bio || '') ||
    emailRegex.test(profileReadmeText || '') ||
    phoneRegex.test(profile.bio || '') ||
    phoneRegex.test(profileReadmeText || '')
  );
  const contactScore = hasPublicEmail ? 2 : 0;
  criteria['contact_info'] = {
    id: 'contact_info',
    name: 'Email & Contact Info',
    nameBangla: 'Email & Contact Info',
    maxScore: 2,
    score: contactScore,
    passed: contactScore === 2,
    status: contactScore === 2 ? 'passed' : 'failed',
    details: hasPublicEmail
      ? 'Contact email/phone number present on profile or README.'
      : 'No public contact email or phone number found.',
    recommendation: contactScore === 0 ? 'Add a professional contact email on profile or README for recruiter outreach.' : undefined,
  };
  if (contactScore === 0) recommendations.push('Add a public contact email to your profile or README.');

  // -------------------------------------------------------------
  // 4. Profile README Banner Image (2 Marks)
  // /  , README     , README
  // -------------------------------------------------------------
  const hasProfileReadme = profileReadmeText.trim().length > 15;
  const hasBannerOrBadges =
    hasProfileReadme &&
    (/<img[^>]+src=[^>]+>/i.test(profileReadmeText) ||
     /!\[[^\]]*\]\([^)]+\)/i.test(profileReadmeText) ||
     profileReadmeLower.includes('banner') ||
     profileReadmeLower.includes('shields.io') ||
     profileReadmeLower.includes('svg'));

  let bannerScore = 0;
  let bannerStatus: 'passed' | 'partial' | 'failed' = 'failed';
  if (hasBannerOrBadges) {
    bannerScore = 2;
    bannerStatus = 'passed';
  } else if (hasProfileReadme) {
    bannerScore = 1;
    bannerStatus = 'partial';
  }

  criteria['readme_banner'] = {
    id: 'readme_banner',
    name: 'Profile README Banner Image',
    nameBangla: 'Profile README Banner Graphics',
    maxScore: 2,
    score: bannerScore,
    passed: bannerScore === 2,
    status: bannerStatus,
    details: bannerScore === 2
      ? 'Profile README contains header banner and visual graphics.'
      : bannerScore === 1
      ? 'Profile README exists but lacks header banner or badges.'
      : 'No profile README found.',
    recommendation: bannerScore < 2 ? 'Decorate your profile README with a visually appealing banner or header badges.' : undefined,
  };
  if (bannerScore < 2) recommendations.push('Add a header banner image or visual badges to your profile README.');

  // -------------------------------------------------------------
  // 5. Name & Professional Designation (4 Marks)
  // ,    ,
  // -------------------------------------------------------------
  const hasName = Boolean(profile.name && profile.name.trim().length > 1);
  const designationRegex = /(?:developer|engineer|programmer|coder|frontend|front-end|backend|back-end|fullstack|full-stack|software|web dev|mern|react|javascript|typescript|next\.?js|node|python|designer)/i;
  const hasDesignation =
    designationRegex.test(profile.bio || '') ||
    designationRegex.test(profile.name || '') ||
    designationRegex.test(profileReadmeText.slice(0, 500));

  let nameScore = 0;
  let nameStatus: 'passed' | 'partial' | 'failed' = 'failed';
  if (hasName && hasDesignation) {
    nameScore = 4;
    nameStatus = 'passed';
  } else if (hasName || hasDesignation) {
    nameScore = 2;
    nameStatus = 'partial';
  }

  criteria['name_and_designation'] = {
    id: 'name_and_designation',
    name: 'Name & Professional Designation',
    nameBangla: 'Name & Professional Designation',
    maxScore: 4,
    score: nameScore,
    passed: nameScore === 4,
    status: nameStatus,
    details: nameScore === 4
      ? `Both name (${profile.name || ''}) and clear professional designation are present.`
      : hasName
      ? 'Name is present, but no specific professional designation found.'
      : hasDesignation
      ? 'Designation is present, but full name is missing.'
      : 'Neither name nor professional designation found.',
    recommendation: nameScore < 4 ? 'Provide full name and clear designation (e.g., Frontend Developer / Full Stack Engineer).' : undefined,
  };
  if (nameScore < 4) recommendations.push('Mention a clear professional designation (e.g., Frontend Developer) in your bio.');

  // -------------------------------------------------------------
  // 6. About Me Section (4 Marks)
  // README   About Me   ,
  // -------------------------------------------------------------
  const aboutMeRegex = /(?:about me|about\b|who i am|hi,?\s*i'?m|hello,?\s*i'?m|passionate\s+developer|i am a\b|i'm a\b|im a\b)/i;
  const hasAboutMe =
    aboutMeRegex.test(profileReadmeText) ||
    (Boolean(profile.bio) && (profile.bio || '').trim().length >= 35);

  const aboutMeScore = hasAboutMe ? 4 : 0;
  criteria['about_me'] = {
    id: 'about_me',
    name: 'About Me Section',
    nameBangla: 'About Me Section',
    maxScore: 4,
    score: aboutMeScore,
    passed: aboutMeScore === 4,
    status: aboutMeScore === 4 ? 'passed' : 'failed',
    details: hasAboutMe
      ? 'Engaging About Me introduction found in profile README or bio.'
      : 'No dedicated About Me section found.',
    recommendation: aboutMeScore === 0 ? 'Add a 2-3 line concise About Me introduction in profile README.' : undefined,
  };
  if (aboutMeScore === 0) recommendations.push('Add an engaging About Me introduction to your profile.');

  // -------------------------------------------------------------
  // 7. Current Activities & Focus (2 Marks)
  // ("working on", "learning", "building")  ,
  // -------------------------------------------------------------
  const focusRegex = /(?:currently\s+working|working\s+on|learning\s+|building\s+|focusing\s+on|specializing\s+in|exploring\s+|contributing\s+to|current\s+focus)/i;
  const hasCurrentFocus = focusRegex.test(profile.bio || '') || focusRegex.test(profileReadmeText);
  const focusScore = hasCurrentFocus ? 2 : 0;
  criteria['current_focus'] = {
    id: 'current_focus',
    name: 'Current Activities & Focus',
    nameBangla: 'Current Activities & Focus',
    maxScore: 2,
    score: focusScore,
    passed: focusScore === 2,
    status: focusScore === 2 ? 'passed' : 'failed',
    details: hasCurrentFocus
      ? 'Current focus and ongoing learning/projects are clearly described.'
      : 'Current activities or focus are not specified.',
    recommendation: focusScore === 0 ? 'Highlight ongoing projects using "Currently working on..." or "Learning...".' : undefined,
  };
  if (focusScore === 0) recommendations.push('Specify what projects or skills you are currently focusing on.');

  // -------------------------------------------------------------
  // 8. Skills Section with Icons (8 Marks)
  // /    ,      ,
  // -------------------------------------------------------------
  const skillsHeaderRegex = /(?:skills|tech stack|technologies|tools|languages|what i work with|skills & tools)/i;
  const hasSkillsHeader = skillsHeaderRegex.test(profileReadmeText);

  const skillsIconRegex = /(?:shields\.io|devicon|skillicons|simpleicons|badge|raw\.githubusercontent\.com[^\s"'>]+icons|<img[^>]+alt="[^"]*(?:react|js|javascript|node|python|css|html|git|next|mongo))/i;
  const hasSkillsIcons = skillsIconRegex.test(profileReadmeText);

  let skillsScore = 0;
  let skillsStatus: 'passed' | 'partial' | 'failed' = 'failed';
  if (hasSkillsHeader && hasSkillsIcons) {
    skillsScore = 8;
    skillsStatus = 'passed';
  } else if (hasSkillsHeader || hasSkillsIcons) {
    skillsScore = 4;
    skillsStatus = 'partial';
  }

  criteria['skills_with_icons'] = {
    id: 'skills_with_icons',
    name: 'Skills Section with Icons',
    nameBangla: 'Tech Skills Section with Icons',
    maxScore: 8,
    score: skillsScore,
    passed: skillsScore === 8,
    status: skillsStatus,
    details: skillsScore === 8
      ? 'Both skill header and visual icons/badges (Shields.io/Devicon) present.'
      : skillsScore === 4
      ? 'Skills section exists but lacks visual icons or proper header.'
      : 'No visual skills section found.',
    recommendation: skillsScore < 8 ? 'Make your skills section modern with Devicon or Shields.io badges.' : undefined,
  };
  if (skillsScore < 8) recommendations.push('Use visual Shields.io or Devicon badges in your skills section.');

  // -------------------------------------------------------------
  // 9. Social & Portfolio Links (4 Marks)
  // ,         ,
  // -------------------------------------------------------------
  const socialRegex = /(?:linkedin\.com\/in\/|twitter\.com\/|x\.com\/|facebook\.com\/|portfolio|hashnode|medium\.com|dev\.to|github\.io|[a-z0-9\-]+\.(?:vercel\.app|netlify\.app|me|dev|com))/i;
  const hasSocialLinks =
    Boolean(profile.blog && profile.blog.trim().length > 3) ||
    Boolean(profile.twitter_username) ||
    socialRegex.test(profileReadmeText) ||
    socialRegex.test(profile.bio || '');

  const socialScore = hasSocialLinks ? 4 : 0;
  criteria['social_links'] = {
    id: 'social_links',
    name: 'Social & Portfolio Links',
    nameBangla: 'Portfolio & Social Links',
    maxScore: 4,
    score: socialScore,
    passed: socialScore === 4,
    status: socialScore === 4 ? 'passed' : 'failed',
    details: hasSocialLinks
      ? 'LinkedIn, Portfolio, or social network links connected.'
      : 'No LinkedIn or personal portfolio link found.',
    recommendation: socialScore === 0 ? 'Add LinkedIn profile and live portfolio link to your GitHub profile.' : undefined,
  };
  if (socialScore === 0) recommendations.push('Add links to your LinkedIn profile and live portfolio.');

  // -------------------------------------------------------------
  // 10. GitHub Stats & Contributions (2 Marks)
  // GitHub Stats        ,
  // -------------------------------------------------------------
  const statsWidgetRegex = /(?:github-readme-stats|github-readme-streak-stats|streak-stats|github-profile-trophy|github-profile-summary-cards|github-readme-activity-graph)/i;
  const hasStatsWidget = statsWidgetRegex.test(profileReadmeText);
  const hasManyRepos = profile.public_repos > 5;

  const statsScore = (hasStatsWidget || hasManyRepos) ? 2 : 0;
  criteria['stats_contributions'] = {
    id: 'stats_contributions',
    name: 'GitHub Stats & Contributions',
    nameBangla: 'GitHub Stats & Contributions',
    maxScore: 2,
    score: statsScore,
    passed: statsScore === 2,
    status: statsScore === 2 ? 'passed' : 'failed',
    details: hasStatsWidget
      ? 'GitHub Readme Stats or Streak Stats widget integrated.'
      : hasManyRepos
      ? `More than 5 public repositories (${profile.public_repos}) available.`
      : 'No stats widget found and repository count is low.',
    recommendation: statsScore === 0 ? 'Add a GitHub Readme Streak Stats widget to your profile to showcase consistency.' : undefined,
  };
  if (statsScore === 0) recommendations.push('Add GitHub Readme Stats or Streak Stats cards to your profile.');

  // -------------------------------------------------------------
  // 11. Pinned / Public Repositories (4 Marks)
  // ≥   ,   ,
  // -------------------------------------------------------------
  const repoCount = Math.max(profile.public_repos, repos.length);
  let repoCountScore = 0;
  let repoCountStatus: 'passed' | 'partial' | 'failed' = 'failed';
  if (repoCount >= 2) {
    repoCountScore = 4;
    repoCountStatus = 'passed';
  } else if (repoCount === 1) {
    repoCountScore = 2;
    repoCountStatus = 'partial';
  }

  criteria['pinned_repos'] = {
    id: 'pinned_repos',
    name: 'Pinned / Public Repositories',
    nameBangla: 'Public Repositories Count',
    maxScore: 4,
    score: repoCountScore,
    passed: repoCountScore === 4,
    status: repoCountStatus,
    details: repoCountScore === 4
      ? `Sufficient public repositories (${repoCount}) found.`
      : repoCountScore === 2
      ? 'Only 1 repository found.'
      : 'No public repositories found.',
    recommendation: repoCountScore < 4 ? 'Make at least 2 complete project repositories public and pinned.' : undefined,
  };
  if (repoCountScore < 4) recommendations.push('Make and pin at least 2 complete project repositories publicly.');

  // -------------------------------------------------------------
  // 12. Project Description in Repositories (8 Marks)
  // Even if ANY 1 repository has a description on GitHub, give marks!
  // -------------------------------------------------------------
  const reposWithDesc = repos.filter(
    (r) => Boolean(r.description && r.description.trim().length >= 4),
  );
  // Also check if any repository README has introductory text
  const hasDescInReadme = Object.values(repoReadmeTexts).some((readme) => {
    const lines = readme.split('\n').map((l) => l.trim()).filter((l) => l.length > 15 && !l.startsWith('#') && !l.startsWith('!'));
    return lines.length > 0;
  });

  const hasRepoDesc = reposWithDesc.length > 0 || hasDescInReadme;
  const descScore = hasRepoDesc ? 8 : 0;
  const describedRepoNames = reposWithDesc.map((r) => r.name);

  criteria['repo_description'] = {
    id: 'repo_description',
    name: 'Project Description in Repositories',
    nameBangla: 'Project Descriptions in Repositories',
    maxScore: 8,
    score: descScore,
    passed: descScore === 8,
    status: descScore === 8 ? 'passed' : 'failed',
    details: hasRepoDesc
      ? `Clear project descriptions found in ${describedRepoNames.length > 0 ? describedRepoNames.join(', ') : 'repositories'}.`
      : 'No clear description provided in repository About section.',
    recommendation: descScore === 0 ? 'Write 1-2 lines in repository About section describing what the project does.' : undefined,
  };
  if (descScore === 0) recommendations.push('Add clear descriptions to your project repositories\' About sections.');

  // -------------------------------------------------------------
  // 13. Live Project Demo Links (4 Marks)
  // Homepage or README deployment links (Vercel, Netlify, Firebase, etc.)
  // -------------------------------------------------------------
  const liveDemoRegex = /(?:vercel\.app|netlify\.app|github\.io|pages\.dev|render\.com|surge\.sh|herokuapp\.com|firebaseapp\.com|railway\.app|onrender\.com)/i;
  const reposWithLiveHomepage = repos.filter(
    (r) => (r.homepage && (r.homepage.startsWith('http') || liveDemoRegex.test(r.homepage))) ||
           (r.description && liveDemoRegex.test(r.description)),
  );
  const hasLiveInReadme = liveDemoRegex.test(allRepoReadmesCombined);
  const hasLiveDemo = reposWithLiveHomepage.length > 0 || hasLiveInReadme;

  const liveDemoScore = hasLiveDemo ? 4 : 0;
  criteria['live_demo'] = {
    id: 'live_demo',
    name: 'Live Project Demo Links',
    nameBangla: 'Live Project Demo Links',
    maxScore: 4,
    score: liveDemoScore,
    passed: liveDemoScore === 4,
    status: liveDemoScore === 4 ? 'passed' : 'failed',
    details: hasLiveDemo
      ? 'Live deployment links (Vercel/Netlify/Firebase) connected in repositories.'
      : 'No live demo website link found in repositories.',
    recommendation: liveDemoScore === 0 ? 'Provide a live Vercel or Netlify site URL in the repository Homepage field.' : undefined,
  };
  if (liveDemoScore === 0) recommendations.push('Add live demo links (Vercel or Netlify) to your repositories.');

  // -------------------------------------------------------------
  // 14. Technologies & Tech Stack Specified (4 Marks)
  // Primary language, topic tags, or tech stack mentions
  // -------------------------------------------------------------
  const reposWithLang = repos.filter((r) => r.language && r.language.trim().length > 0);
  const reposWithTopics = repos.filter((r) => r.topics && r.topics.length > 0);
  const hasTechStack =
    reposWithLang.length > 0 ||
    reposWithTopics.length > 0 ||
    /(?:react|next\.?js|javascript|typescript|tailwind|node|express|mongodb|python)/i.test(allRepoReadmesCombined);

  const techStackScore = hasTechStack ? 4 : 0;
  criteria['tech_stack'] = {
    id: 'tech_stack',
    name: 'Technologies & Tech Stack Specified',
    nameBangla: 'Technologies & Tags Specified',
    maxScore: 4,
    score: techStackScore,
    passed: techStackScore === 4,
    status: techStackScore === 4 ? 'passed' : 'failed',
    details: hasTechStack
      ? `Primary language and framework specified in repositories (${reposWithLang.map((r) => r.language).filter(Boolean).slice(0, 3).join(', ') || 'Tech stack detected'}).`
      : 'No specific technology or framework tags found.',
    recommendation: techStackScore === 0 ? 'Add proper language and topic tags (react, tailwindcss, etc.) to your repositories.' : undefined,
  };
  if (techStackScore === 0) recommendations.push('Properly specify topic tags and primary languages in your repositories.');

  // -------------------------------------------------------------
  // 15. Repository README File Quality (4 Marks)
  // Evaluates README in project repositories: Overview, Features, Setup, Tech Stack
  // -------------------------------------------------------------
  const reposWithReadmeEntries = Object.entries(repoReadmeTexts).filter(
    ([, text]) => Boolean(text && text.trim().length >= 30),
  );
  const reposWithReadmeNames = reposWithReadmeEntries.map(([name]) => name);

  // Flexible section headers matching markdown headers (#, ##, ###, ####) or bold text labels
  const flexibleReadmeSectionRegex = /(?:#{1,4}\s*(?:overview|about|features|key features|technologies|tech stack|tools|built with|installation|setup|getting started|how to run|run locally|usage|scripts|dependencies|screenshots|preview|api|contributing)|(?:\*\*|__)(?:overview|about|features|tech stack|technologies|installation|setup|getting started|how to run|usage)(?:\*\*|__):?)/gi;

  const structuredReadmeMatches = allRepoReadmesCombined.match(flexibleReadmeSectionRegex);
  const hasStructuredSections = Boolean(structuredReadmeMatches && structuredReadmeMatches.length >= 1);
  const hasSubstantialReadme = allRepoReadmesCombined.trim().length >= 120;
  const hasAnyReadme = reposWithReadmeNames.length > 0;

  let readmeQualityScore = 0;
  let readmeStatus: 'passed' | 'partial' | 'failed' = 'failed';

  if (hasAnyReadme && (hasStructuredSections || hasSubstantialReadme)) {
    readmeQualityScore = 4;
    readmeStatus = 'passed';
  } else if (hasAnyReadme) {
    readmeQualityScore = 2;
    readmeStatus = 'partial';
  }

  criteria['readme_quality'] = {
    id: 'readme_quality',
    name: 'Repository README File Quality',
    nameBangla: 'Project README Quality',
    maxScore: 4,
    score: readmeQualityScore,
    passed: readmeQualityScore === 4,
    status: readmeStatus,
    details: readmeQualityScore === 4
      ? `Structured README found in repository (${reposWithReadmeNames.join(', ')}).`
      : readmeQualityScore === 2
      ? `README file found in (${reposWithReadmeNames.join(', ')}), but could be improved with more detailed sections.`
      : 'No project README found in repositories.',
    recommendation: readmeQualityScore === 0 ? 'Write a README with screenshots, feature list, and setup instructions in repositories.' : undefined,
  };
  if (readmeQualityScore === 0) recommendations.push('Write structured READMEs including Overview, Features, and Setup guides in repositories.');

  // Calculate Total Score (out of 60)
  const totalScore = Object.values(criteria).reduce((sum, c) => sum + c.score, 0);
  const percentage = Math.round((totalScore / 60) * 100);

  // Final Status & Grade
  // ≥ 50: Excellent Profile
  // 40 - 49: Strong Profile
  // 30 - 39: Moderate Profile
  // < 30: Needs Improvement
  let grade: 'Excellent Profile' | 'Strong Profile' | 'Moderate Profile' | 'Needs Improvement';
  let gradeBangla: string;

  if (totalScore >= 50) {
    grade = 'Excellent Profile';
    gradeBangla = 'Outstanding Profile (Excellent — International Standard)';
  } else if (totalScore >= 40) {
    grade = 'Strong Profile';
    gradeBangla = 'Strong Profile (Strong — Job Ready)';
  } else if (totalScore >= 30) {
    grade = 'Moderate Profile';
    gradeBangla = 'Moderate Profile (Moderate — Needs Improvements)';
  } else {
    grade = 'Needs Improvement';
    gradeBangla = 'Needs Improvement (Needs Improvement — Critical Updates Required)';
  }

  // Repo Summary
  const repoSummary = {
    totalChecked: repos.length,
    reposWithDescription: reposWithDesc.length,
    reposWithLiveDemo: reposWithLiveHomepage.length,
    reposWithReadme: Object.keys(repoReadmeTexts).length,
    topLanguages: Array.from(new Set(repos.map((r) => r.language).filter(Boolean))) as string[],
  };

  return {
    username,
    profileUrl: `https://github.com/${username}`,
    avatarUrl: profile.avatar_url || 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png',
    name: profile.name || username,
    bio: profile.bio || '',
    location: profile.location || '',
    publicReposCount: profile.public_repos,
    hasProfileReadme,
    totalScore,
    percentage,
    grade,
    gradeBangla,
    criteria,
    criteriaList: Object.values(criteria),
    recommendations,
    repoSummary,
    fetchedVia,
  };
}
