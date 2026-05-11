
export type LanguageVariant = {
    label: string;
    primary: string;
    alternates: string[];
    deepgramCode?: string; // Deepgram uses different language codes
};

// Keep backward compat alias
export type EnglishVariant = LanguageVariant;

export const ENGLISH_VARIANTS: Record<string, LanguageVariant> = {
    'english-india': {
        label: 'English (India)',
        primary: 'en-IN',
        alternates: ['en-US', 'en-GB', 'en-AU', 'en-CA'],
        deepgramCode: 'en',
    },
    'english-us': {
        label: 'English (United States)',
        primary: 'en-US',
        alternates: ['en-IN', 'en-GB', 'en-AU', 'en-CA'],
        deepgramCode: 'en-US',
    },
    'english-uk': {
        label: 'English (United Kingdom)',
        primary: 'en-GB',
        alternates: ['en-IN', 'en-US', 'en-AU', 'en-CA'],
        deepgramCode: 'en-GB',
    },
    'english-au': {
        label: 'English (Australia)',
        primary: 'en-AU',
        alternates: ['en-GB', 'en-US', 'en-IN', 'en-CA'],
        deepgramCode: 'en-AU',
    },
    'english-ca': {
        label: 'English (Canada)',
        primary: 'en-CA',
        alternates: ['en-US', 'en-GB', 'en-IN', 'en-AU'],
        deepgramCode: 'en',
    },
    'polish': {
        label: 'Polski (Polish)',
        primary: 'pl-PL',
        alternates: [],
        deepgramCode: 'pl',
    },
};

