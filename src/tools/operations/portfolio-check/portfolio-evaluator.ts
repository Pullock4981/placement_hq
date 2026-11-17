// Portfolio Check (60 Marks Deterministic Master Rubric Engine)
// 100% Deterministic, 0% AI Tokens, Client-side SPA Bundle & WAF Support

export interface PortfolioCriterionResult {
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

export interface PortfolioEvaluationResult {
  url: string;
  isBlockedByAuthOrDashboard?: boolean;
  isCloudflareBlocked?: boolean;
  blockedMessage?: string;
  pageTitle?: string;
  totalScore: number; // Max 60
  percentage: number; // (totalScore / 60) * 100
  grade: 'Outstanding Portfolio' | 'Strong Portfolio' | 'Moderate Portfolio' | 'Needs Improvement';
  gradeBangla: string;
  criteria: Record<string, PortfolioCriterionResult>;
  criteriaList: PortfolioCriterionResult[];
  recommendations: string[];
  findings: {
    hasNav: boolean;
    hasHeroPhoto: boolean;
    hasDesignation: boolean;
    hasResumeBtn: boolean;
    hasSocials: boolean;
    hasAboutMe: boolean;
    hasSkillsVisuals: boolean;
    hasEducation: boolean;
    hasExperienceBonus: boolean;
    projectCount: number;
    projectDetails: {
      hasTechStack: boolean;
      hasDescription: boolean;
      hasLiveDemo: boolean;
      hasGithubRepo: boolean;
    };
    hasContact: boolean;
    hasResponsiveDesign: boolean;
  };
  fetchedVia: 'direct' | 'spa-bundles' | 'pasted-html' | 'error';
}

/**
 * Filter Auth Wall / Invalid Dashboard URLs (Vercel/Netlify Dashboard, Localhost, etc.)
 */
export function validatePortfolioUrl(url: string): { isValid: boolean; reason?: string } {
  if (!url) return { isValid: false, reason: 'No portfolio URL provided.' };
  const trimmed = url.trim().toLowerCase();

  // Vercel Dashboard or Project settings
  if (trimmed.includes('vercel.com/') && !trimmed.includes('.vercel.app')) {
    return {
      isValid: false,
      reason: 'Invalid dashboard URL detected. Candidate shared a Vercel project/dashboard link instead of live website. Please provide live deployment URL (e.g. your-project.vercel.app).',
    };
  }

  // Netlify Dashboard
  if (trimmed.includes('app.netlify.com/')) {
    return {
      isValid: false,
      reason: 'Invalid dashboard URL detected. Candidate shared a Netlify admin/dashboard link instead of live website. Please provide live deployment URL (e.g. your-project.netlify.app).',
    };
  }

  // Localhost
  if (trimmed.includes('localhost') || trimmed.includes('127.0.0.1')) {
    return {
      isValid: false,
      reason: 'Localhost URL provided, which cannot be browsed remotely. Please provide a live public deployment URL.',
    };
  }

  return { isValid: true };
}

/**
 * Download & extract client-side JavaScript bundles (React / Vite / Next.js)
 */
async function fetchJsBundles(html: string, baseUrl: string): Promise<string> {
  let combinedJs = '';
  try {
    const scriptRegex = /<script[^>]+src=["']([^"']+\.js[^"']*)["']/gi;
    let match: RegExpExecArray | null;
    let count = 0;

    while ((match = scriptRegex.exec(html)) !== null && count < 3) {
      const src = match[1];
      if (
        !src ||
        src.includes('google-analytics') ||
        src.includes('googletagmanager') ||
        src.includes('clarity.ms')
      ) {
        continue;
      }

      let fullUrl = src;
      if (src.startsWith('//')) {
        fullUrl = 'https:' + src;
      } else if (src.startsWith('/')) {
        const origin = new URL(baseUrl).origin;
        fullUrl = origin + src;
      } else if (!src.startsWith('http')) {
        fullUrl = new URL(src, baseUrl).href;
      }

      try {
        const res = await fetch(fullUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          signal: AbortSignal.timeout(3500),
        });
        if (res.ok) {
          const jsContent = await res.text();
          combinedJs += ' ' + jsContent.slice(0, 250000); // 250KB max per chunk
          count++;
        }
      } catch {
        // Ignore single script failure
      }
    }
  } catch {
    // Non-fatal
  }
  return combinedJs;
}

/**
 * Fetch HTML or crawl internal project detail page
 */
export async function fetchPortfolioContent(
  rawUrl: string,
  pastedHtml?: string,
): Promise<{
  html: string;
  projectDetailHtml?: string;
  isCloudflareBlocked: boolean;
  fetchedVia: 'direct' | 'spa-bundles' | 'pasted-html' | 'error';
}> {
  // If user pasted HTML (Cloudflare fallback)
  if (pastedHtml && pastedHtml.trim().length > 50) {
    return {
      html: pastedHtml,
      isCloudflareBlocked: false,
      fetchedVia: 'pasted-html',
    };
  }

  let canonicalUrl = rawUrl.trim();
  if (!canonicalUrl.startsWith('http://') && !canonicalUrl.startsWith('https://')) {
    canonicalUrl = 'https://' + canonicalUrl;
  }

  try {
    const res = await fetch(canonicalUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept':
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(7000),
      redirect: 'follow',
    });

    const html = await res.text();

    // Check Cloudflare WAF or Bot Challenge
    const isCf =
      res.status === 403 ||
      res.status === 503 ||
      html.includes('cf-browser-verification') ||
      html.includes('challenge-running') ||
      html.includes('Just a moment...') ||
      html.includes('Turnstile');

    if (isCf) {
      return {
        html,
        isCloudflareBlocked: true,
        fetchedVia: 'error',
      };
    }

    // Check if SPA with client-side bundle
    let combinedContent = html;
    let fetchedVia: 'direct' | 'spa-bundles' = 'direct';

    const hasMinimalHtml = html.length < 5000 && (html.includes('<div id="root">') || html.includes('<div id="__next">'));
    if (hasMinimalHtml || html.includes('.js')) {
      const jsBundles = await fetchJsBundles(html, canonicalUrl);
      if (jsBundles.length > 500) {
        combinedContent += '\n\n/* SPA_CLIENT_BUNDLE */\n' + jsBundles;
        fetchedVia = 'spa-bundles';
      }
    }

    // Attempt to crawl internal project detail page
    let projectDetailHtml = '';
    try {
      const internalProjectMatch = combinedContent.match(/(?:\/projects?\/[a-zA-Z0-9_-]+|\/details\/[a-zA-Z0-9_-]+)/i);
      if (internalProjectMatch && internalProjectMatch[0]) {
        const detailPath = internalProjectMatch[0];
        const detailUrl = new URL(detailPath, canonicalUrl).href;
        const detailRes = await fetch(detailUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(3000),
        });
        if (detailRes.ok) {
          projectDetailHtml = await detailRes.text();
        }
      }
    } catch {
      // Non-fatal
    }

    return {
      html: combinedContent,
      projectDetailHtml,
      isCloudflareBlocked: false,
      fetchedVia,
    };
  } catch (err: unknown) {
    const e = err as Error;
    return {
      html: `<!-- Error: ${e.message} -->`,
      isCloudflareBlocked: false,
      fetchedVia: 'error',
    };
  }
}

/**
 * 12-Criteria Portfolio Deterministic Evaluation Engine (60 Marks)
 */
export function evaluatePortfolio(
  rawUrl: string,
  htmlContent: string,
  projectDetailHtml = '',
  isCloudflareBlocked = false,
  fetchedVia: 'direct' | 'spa-bundles' | 'pasted-html' | 'error' = 'direct',
): PortfolioEvaluationResult {
  const urlValidation = validatePortfolioUrl(rawUrl);

  // 1. Auth Wall / Dashboard Blocked handling
  if (!urlValidation.isValid) {
    const criteria: Record<string, PortfolioCriterionResult> = {};
    const criteriaList: PortfolioCriterionResult[] = [];
    const emptyFindings = {
      hasNav: false,
      hasHeroPhoto: false,
      hasDesignation: false,
      hasResumeBtn: false,
      hasSocials: false,
      hasAboutMe: false,
      hasSkillsVisuals: false,
      hasEducation: false,
      hasExperienceBonus: false,
      projectCount: 0,
      projectDetails: {
        hasTechStack: false,
        hasDescription: false,
        hasLiveDemo: false,
        hasGithubRepo: false,
      },
      hasContact: false,
      hasResponsiveDesign: false,
    };

    return {
      url: rawUrl,
      isBlockedByAuthOrDashboard: true,
      blockedMessage: urlValidation.reason,
      totalScore: 0,
      percentage: 0,
      grade: 'Needs Improvement',
      gradeBangla: 'Needs Improvement (Needs Improvement — 0 Marks)',
      criteria,
      criteriaList,
      recommendations: [urlValidation.reason || 'Please provide a valid live portfolio link.'],
      findings: emptyFindings,
      fetchedVia: 'error',
    };
  }

  // 2. Cloudflare Challenge Blocked handling
  if (isCloudflareBlocked) {
    return {
      url: rawUrl,
      isCloudflareBlocked: true,
      blockedMessage:
        'Cloudflare Turnstile or Bot Challenge detected. Please open the portfolio site in your browser, press Ctrl+U, and paste the page source HTML.',
      totalScore: 0,
      percentage: 0,
      grade: 'Needs Improvement',
      gradeBangla: 'Cloudflare Challenge (Paste Source via Ctrl+U)',
      criteria: {},
      criteriaList: [],
      recommendations: [
        'Could not scrape site due to Cloudflare challenge. Press Ctrl+U in browser and paste the page source.'
      ],
      findings: {
        hasNav: false,
        hasHeroPhoto: false,
        hasDesignation: false,
        hasResumeBtn: false,
        hasSocials: false,
        hasAboutMe: false,
        hasSkillsVisuals: false,
        hasEducation: false,
        hasExperienceBonus: false,
        projectCount: 0,
        projectDetails: {
          hasTechStack: false,
          hasDescription: false,
          hasLiveDemo: false,
          hasGithubRepo: false,
        },
        hasContact: false,
        hasResponsiveDesign: false,
      },
      fetchedVia: 'error',
    };
  }

  const text = htmlContent.toLowerCase();
  const detailText = (projectDetailHtml || '').toLowerCase();
  const fullText = text + ' ' + detailText;

  // Extract Page Title
  const titleMatch = htmlContent.match(/<title[^>]*>([^<]+)<\/title>/i);
  const pageTitle = titleMatch ? titleMatch[1].trim() : 'Portfolio Site';

  const criteria: Record<string, PortfolioCriterionResult> = {};
  const recommendations: string[] = [];

  // -------------------------------------------------------------
  // 1. Responsive Navigation Bar (5 Marks)
  // <nav>, <header>,
  // -------------------------------------------------------------
  const hasNavTag = text.includes('<nav') || text.includes('<header');
  const hasSectionLinks =
    text.includes('#about') ||
    text.includes('#skills') ||
    text.includes('#projects') ||
    text.includes('#contact') ||
    text.includes('#experience');
  const hasMobileToggle =
    text.includes('hamburger') ||
    text.includes('menu') ||
    text.includes('aria-label="menu"') ||
    text.includes('aria-label="toggle') ||
    text.includes('md:hidden') ||
    text.includes('sm:hidden');

  let navScore = 0;
  let navStatus: 'passed' | 'partial' | 'failed' = 'failed';
  if (hasNavTag && hasSectionLinks && hasMobileToggle) {
    navScore = 5;
    navStatus = 'passed';
  } else if (hasNavTag && (hasSectionLinks || hasMobileToggle)) {
    navScore = 3;
    navStatus = 'partial';
  }

  criteria['nav_bar'] = {
    id: 'nav_bar',
    name: 'Responsive Navigation Bar',
    nameBangla: 'Responsive Navigation Bar',
    maxScore: 5,
    score: navScore,
    passed: navScore === 5,
    status: navStatus,
    details:
      navScore === 5
        ? 'Header/nav tag, mobile hamburger toggle and section scroll anchors present.'
        : navScore === 3
        ? 'Navigation bar present but lacks mobile toggle or smooth scroll anchors.'
        : 'Proper responsive navigation bar not found.',
    recommendation:
      navScore < 5
        ? 'Add a sticky navbar with mobile hamburger menu and #about, #skills, #projects, #contact anchor links.'
        : undefined,
  };
  if (navScore < 5) recommendations.push('Enhance navigation bar with mobile hamburger menu and smooth scroll anchors.');

  // -------------------------------------------------------------
  // 2. Designation & Professional Photo (4 Marks)
  // /
  // -------------------------------------------------------------
  const hasHeroPhoto =
    text.includes('<img') ||
    text.includes('avatar') ||
    text.includes('profile') ||
    text.includes('hero') ||
    text.includes('rounded-full');
  const designationRegex =
    /(?:frontend developer|front-end developer|full stack developer|fullstack developer|software engineer|mern stack developer|react developer|web developer)/i;
  const hasDesignation = designationRegex.test(fullText);

  let heroScore = 0;
  let heroStatus: 'passed' | 'partial' | 'failed' = 'failed';
  if (hasHeroPhoto && hasDesignation) {
    heroScore = 4;
    heroStatus = 'passed';
  } else if (hasHeroPhoto || hasDesignation) {
    heroScore = 2;
    heroStatus = 'partial';
  }

  criteria['hero_designation'] = {
    id: 'hero_designation',
    name: 'Designation & Professional Photo',
    nameBangla: 'Designation & Professional Photo',
    maxScore: 4,
    score: heroScore,
    passed: heroScore === 4,
    status: heroStatus,
    details:
      heroScore === 4
        ? 'Professional photo and clear designation present in hero section.'
        : hasHeroPhoto
        ? 'Photo present, but no specific professional designation found.'
        : hasDesignation
        ? 'Designation present, but professional profile photo is missing.'
        : 'Neither photo nor designation found in hero section.',
    recommendation:
      heroScore < 4
        ? 'Include a clear professional designation (e.g. Frontend Developer) and clean headshot in hero section.'
        : undefined,
  };
  if (heroScore < 4) recommendations.push('Ensure your clear designation and custom professional photo are in the hero section.');

  // -------------------------------------------------------------
  // 3. Resume Download Button (4 Marks)
  // /     /
  // -------------------------------------------------------------
  const resumeRegex = /(?:resume|curriculum vitae|\bcv\b|download resume|view resume|download cv|view cv)/i;
  const hasResumeBtn =
    resumeRegex.test(fullText) &&
    (text.includes('href') || text.includes('<button') || text.includes('drive.google.com'));

  const resumeScore = hasResumeBtn ? 4 : 0;
  criteria['resume_button'] = {
    id: 'resume_button',
    name: 'Resume Download Button',
    nameBangla: 'Resume Download / View Button',
    maxScore: 4,
    score: resumeScore,
    passed: resumeScore === 4,
    status: resumeScore === 4 ? 'passed' : 'failed',
    details: hasResumeBtn
      ? 'Active button or link to download or view resume/CV.'
      : 'No clear resume or CV download button found on portfolio.',
    recommendation:
      resumeScore === 0
        ? 'Add a "Download Resume" button in hero section or navbar linking to Google Drive or PDF.'
        : undefined,
  };
  if (resumeScore === 0) recommendations.push('Add an active, working "Resume Download / View" button.');

  // -------------------------------------------------------------
  // 4. Social Media Links (4 Marks)
  // GitHub, LinkedIn
  // -------------------------------------------------------------
  const hasGithub = fullText.includes('github.com/');
  const hasLinkedin = fullText.includes('linkedin.com/');
  const hasSocials = hasGithub || hasLinkedin || fullText.includes('twitter.com/') || fullText.includes('facebook.com/');

  const socialScore = hasGithub && hasLinkedin ? 4 : hasSocials ? 2 : 0;
  criteria['social_media'] = {
    id: 'social_media',
    name: 'Social Media Links',
    nameBangla: 'GitHub & LinkedIn Social Links',
    maxScore: 4,
    score: socialScore,
    passed: socialScore === 4,
    status: socialScore === 4 ? 'passed' : socialScore === 2 ? 'partial' : 'failed',
    details:
      socialScore === 4
        ? 'Both GitHub and LinkedIn profile links are active.'
        : socialScore === 2
        ? 'Social links present, but missing either GitHub or LinkedIn.'
        : 'No social media or professional links found.',
    recommendation:
      socialScore < 4 ? 'Include active GitHub and LinkedIn profile links in the footer or hero section.' : undefined,
  };
  if (socialScore < 4) recommendations.push('Include both GitHub and LinkedIn links effectively.');

  // -------------------------------------------------------------
  // 5. “About Me” Section (6 Marks)
  // About Me    /
  // -------------------------------------------------------------
  const aboutMeRegex = /(?:about me|about myself|who i am|my journey|about us|id="about")/i;
  const hasAboutMe = aboutMeRegex.test(fullText);

  const aboutScore = hasAboutMe ? 6 : 0;
  criteria['about_me'] = {
    id: 'about_me',
    name: '“About Me” Section',
    nameBangla: '“About Me” Section',
    maxScore: 6,
    score: aboutScore,
    passed: aboutScore === 6,
    status: aboutScore === 6 ? 'passed' : 'failed',
    details: hasAboutMe
      ? 'Dedicated About Me section presenting personal background and career journey.'
      : 'No dedicated About Me section found.',
    recommendation:
      aboutScore === 0
        ? 'Add a rich "About Me" section describing your passion, problem-solving skills, and journey.'
        : undefined,
  };
  if (aboutScore === 0) recommendations.push('Create an engaging About Me section highlighting your skills and career goals.');

  // -------------------------------------------------------------
  // 6. Skills Section with Visuals (6 Marks)
  // (Frontend, Backend, Tools)
  // -------------------------------------------------------------
  const skillsRegex = /(?:skills|technologies|tech stack|tools|my expertise|id="skills")/i;
  const hasSkillsHeader = skillsRegex.test(fullText);
  const hasSkillsVisuals =
    text.includes('svg') ||
    text.includes('<img') ||
    text.includes('devicon') ||
    text.includes('icons') ||
    text.includes('badge') ||
    text.includes('frontend') ||
    text.includes('backend');

  let skillsScore = 0;
  let skillsStatus: 'passed' | 'partial' | 'failed' = 'failed';
  if (hasSkillsHeader && hasSkillsVisuals) {
    skillsScore = 6;
    skillsStatus = 'passed';
  } else if (hasSkillsHeader || hasSkillsVisuals) {
    skillsScore = 3;
    skillsStatus = 'partial';
  }

  criteria['skills_section'] = {
    id: 'skills_section',
    name: 'Skills Section with Visuals',
    nameBangla: 'Skills Section with Visuals',
    maxScore: 6,
    score: skillsScore,
    passed: skillsScore === 6,
    status: skillsStatus,
    details:
      skillsScore === 6
        ? 'Technical skills neatly organized with categories and visual icons/badges.'
        : skillsScore === 3
        ? 'Skills section exists but lacks visual icons or categorization.'
        : 'No dedicated skills section found.',
    recommendation:
      skillsScore < 6
        ? 'Group skills into Frontend, Backend, and Tools categories with visual logos/icons.'
        : undefined,
  };
  if (skillsScore < 6) recommendations.push('Organize technical skills with icons into Frontend, Backend, and Tools categories.');

  // -------------------------------------------------------------
  // 7. Education Section (3 Marks)
  // (, , , CSE)
  // -------------------------------------------------------------
  const eduRegex = /(?:education|b\.?sc|diploma|university|college|hsc|ssc|bachelor|institute|cse|id="education")/i;
  const hasEducation = eduRegex.test(fullText);

  const eduScore = hasEducation ? 3 : 0;
  criteria['education_section'] = {
    id: 'education_section',
    name: 'Education Section',
    nameBangla: 'Education Section',
    maxScore: 3,
    score: eduScore,
    passed: eduScore === 3,
    status: eduScore === 3 ? 'passed' : 'failed',
    details: hasEducation
      ? 'Educational background (degree, institution, department) clearly listed.'
      : 'No mention of educational background found on portfolio.',
    recommendation: eduScore === 0 ? 'Add an Education section including degree, institution, and graduation year.' : undefined,
  };
  if (eduScore === 0) recommendations.push('Add an Education section with your degree and institution details.');

  // -------------------------------------------------------------
  // 8. Experience Bonus (3 Marks)
  // 
  // -------------------------------------------------------------
  criteria['experience_bonus'] = {
    id: 'experience_bonus',
    name: 'Experience Bonus',
    nameBangla: 'Experience Bonus (Fresher Fair Scoring)',
    maxScore: 3,
    score: 3,
    passed: true,
    status: 'passed',
    details: 'Full 3 marks bonus included to maintain fair scoring since prior work experience is not required for freshers.',
  };

  // -------------------------------------------------------------
  // 9. Project Cards (at least 2) (6 Marks)
  // ,   View Details/Demo
  // -------------------------------------------------------------
  const projectCardCount = (fullText.match(/(?:live demo|view project|view demo|project details|source code|client code)/gi) || []).length;
  const hasProjectHeader = /(?:projects|my work|portfolio|featured projects|id="projects")/i.test(fullText);

  let projectScore = 0;
  let projectStatus: 'passed' | 'partial' | 'failed' = 'failed';
  if (projectCardCount >= 2 || (hasProjectHeader && projectCardCount >= 1)) {
    projectScore = 6;
    projectStatus = 'passed';
  } else if (projectCardCount === 1 || hasProjectHeader) {
    projectScore = 3;
    projectStatus = 'partial';
  }

  criteria['project_cards'] = {
    id: 'project_cards',
    name: 'Project Cards (at least 2)',
    nameBangla: 'Project Cards (at least 2)',
    maxScore: 6,
    score: projectScore,
    passed: projectScore === 6,
    status: projectStatus,
    details:
      projectScore === 6
        ? 'Multiple project cards complete with title, screenshot, and action buttons.'
        : projectScore === 3
        ? 'Only 1 project or incomplete project cards found.'
        : 'No project cards detected.',
    recommendation:
      projectScore < 6 ? 'Showcase at least 2 complete project cards (with screenshots, title, and buttons).' : undefined,
  };
  if (projectScore < 6) recommendations.push('Showcase at least 2 full project cards with screenshots and demo buttons.');

  // -------------------------------------------------------------
  // 10. Project Detail Page Breakdown (9 Marks)
  // • Tech Stack:
  // • Project Description / Features:
  // • Live Demo Link:
  // • GitHub Repository Link:
  // (:  +  +  +  =  )
  // -------------------------------------------------------------
  const hasDetailTechStack = /(?:react|next\.?js|node|tailwind|express|mongodb|firebase|typescript|javascript)/i.test(fullText);
  const hasDetailDesc =
    fullText.includes('feature') ||
    fullText.includes('overview') ||
    fullText.includes('built with') ||
    fullText.includes('authentication') ||
    fullText.length > 5000;
  const hasDetailLiveDemo =
    fullText.includes('live demo') ||
    fullText.includes('view live') ||
    fullText.includes('live site') ||
    /(?:vercel\.app|netlify\.app|github\.io|pages\.dev|onrender\.com)/i.test(fullText);
  const hasDetailGithub =
    fullText.includes('github.com/') ||
    fullText.includes('client code') ||
    fullText.includes('server code') ||
    fullText.includes('source code');

  const detailBreakdownScore =
    (hasDetailTechStack ? 1 : 0) +
    (hasDetailDesc ? 4 : 0) +
    (hasDetailLiveDemo ? 2 : 0) +
    (hasDetailGithub ? 2 : 0);

  criteria['project_detail_breakdown'] = {
    id: 'project_detail_breakdown',
    name: 'Project Detail Breakdown',
    nameBangla: 'Project Detail Breakdown',
    maxScore: 9,
    score: detailBreakdownScore,
    passed: detailBreakdownScore === 9,
    status: detailBreakdownScore === 9 ? 'passed' : detailBreakdownScore >= 5 ? 'partial' : 'failed',
    details: `Tech Stack: ${hasDetailTechStack ? '1/1' : '0/1'}, Features/Desc: ${hasDetailDesc ? '4/4' : '0/4'}, Live Demo: ${hasDetailLiveDemo ? '2/2' : '0/2'}, GitHub Repo: ${hasDetailGithub ? '2/2' : '0/2'} (Scored: ${detailBreakdownScore}/9)`,
    recommendation:
      detailBreakdownScore < 9
        ? 'Include tech stack, feature description, live demo, and GitHub client/server links for each project.'
        : undefined,
  };
  if (detailBreakdownScore < 9) recommendations.push('Ensure tech stack, feature breakdown, live site, and GitHub links for each project.');

  // -------------------------------------------------------------
  // 11. Contact Section (4 Marks)
  // , ,
  // -------------------------------------------------------------
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i;
  const phoneRegex = /(?:\+?880|01|\+?\d{1,3}[-.\s]?)?\d{9,11}/;
  const hasContact =
    text.includes('<form') ||
    text.includes('mailto:') ||
    text.includes('wa.me') ||
    text.includes('whatsapp') ||
    text.includes('contact me') ||
    text.includes('get in touch') ||
    emailRegex.test(text) ||
    phoneRegex.test(text);

  const contactScore = hasContact ? 4 : 0;
  criteria['contact_section'] = {
    id: 'contact_section',
    name: 'Contact Section',
    nameBangla: 'Contact Section',
    maxScore: 4,
    score: contactScore,
    passed: contactScore === 4,
    status: contactScore === 4 ? 'passed' : 'failed',
    details: hasContact
      ? 'Contact form or direct email/phone contact options provided.'
      : 'No active contact form or contact links found.',
    recommendation:
      contactScore === 0
        ? 'Add an active contact form or direct email/WhatsApp links for recruiter outreach.'
        : undefined,
  };
  if (contactScore === 0) recommendations.push('Add a working contact form or direct email/WhatsApp links.');

  // -------------------------------------------------------------
  // 12. Clean & Responsive Design (6 Marks)
  // Viewport  ,    (sm:, md:, lg:, Flexbox/Grid)
  // -------------------------------------------------------------
  const hasViewport = text.includes('name="viewport"') || text.includes("name='viewport'") || text.includes('width=device-width');
  const hasResponsiveClasses =
    text.includes('sm:') ||
    text.includes('md:') ||
    text.includes('lg:') ||
    text.includes('flex') ||
    text.includes('grid') ||
    text.includes('@media');

  let responsiveScore = 2; // baseline
  let responsiveStatus: 'passed' | 'partial' | 'failed' = 'partial';
  if (hasViewport && hasResponsiveClasses) {
    responsiveScore = 6;
    responsiveStatus = 'passed';
  }

  criteria['responsive_design'] = {
    id: 'responsive_design',
    name: 'Clean & Responsive Design',
    nameBangla: 'Clean & Responsive Design',
    maxScore: 6,
    score: responsiveScore,
    passed: responsiveScore === 6,
    status: responsiveStatus,
    details:
      responsiveScore === 6
        ? 'Viewport meta tag and modern responsive grid/flexbox classes active.'
        : 'Basic styling detected; mobile responsiveness should be improved.',
    recommendation:
      responsiveScore < 6 ? 'Ensure mobile and tablet responsiveness using Tailwind sm:, md:, lg: breakpoints.' : undefined,
  };
  if (responsiveScore < 6) recommendations.push('Optimize layout for mobile and tablet devices.');

  // Total Score Sum (out of 60)
  const totalScore = Object.values(criteria).reduce((sum, c) => sum + c.score, 0);
  const percentage = Math.round((totalScore / 60) * 100);

  // Grading Scale:
  // ≥ : Outstanding Portfolio (Emerald)
  // - : Strong Portfolio (Indigo)
  // - : Moderate Portfolio (Amber)
  // < : Needs Improvement (Rose)
  let grade: 'Outstanding Portfolio' | 'Strong Portfolio' | 'Moderate Portfolio' | 'Needs Improvement';
  let gradeBangla: string;

  if (totalScore >= 50) {
    grade = 'Outstanding Portfolio';
    gradeBangla = 'Outstanding Portfolio (Outstanding — International Standard)';
  } else if (totalScore >= 40) {
    grade = 'Strong Portfolio';
    gradeBangla = 'Strong Portfolio (Strong — Job Ready)';
  } else if (totalScore >= 30) {
    grade = 'Moderate Portfolio';
    gradeBangla = 'Moderate Portfolio (Moderate — Needs Improvements)';
  } else {
    grade = 'Needs Improvement';
    gradeBangla = 'Needs Improvement (Needs Improvement — Rework Required)';
  }

  return {
    url: rawUrl,
    pageTitle,
    totalScore,
    percentage,
    grade,
    gradeBangla,
    criteria,
    criteriaList: Object.values(criteria),
    recommendations,
    findings: {
      hasNav: navScore === 5,
      hasHeroPhoto,
      hasDesignation,
      hasResumeBtn,
      hasSocials,
      hasAboutMe,
      hasSkillsVisuals,
      hasEducation,
      hasExperienceBonus: true,
      projectCount: projectCardCount,
      projectDetails: {
        hasTechStack: hasDetailTechStack,
        hasDescription: hasDetailDesc,
        hasLiveDemo: hasDetailLiveDemo,
        hasGithubRepo: hasDetailGithub,
      },
      hasContact: contactScore === 4,
      hasResponsiveDesign: responsiveScore === 6,
    },
    fetchedVia,
  };
}

