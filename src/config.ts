import { refreshIconIndicator } from './util';

/**
 * Check if the input string is a regex or an explicit HTTP header.
 * @param str a string value that's either a regex or an explicit HTTP header
 * @returns
 */
export function isRegex(str: string): boolean {
    const regexIndicators = [
        /\\[dDsSwWbB]/, // escaped shorthand classes
        /\\./, // escaped dot
        /[.*+?^${}()|[\]]/, // unescaped special characters
    ];
    return regexIndicators.some((pattern) => pattern.test(str));
}

/**
 * Prase the input string value and return an HTTP header key-value pair.
 * @param header a string value to be parsed as HTTP header key and value
 * @returns HTTP header key-value pair
 */
export function parseHeader(header: string): { key: string; value: string } {
    const [key, value] = header.split(':').map((s) => s.trim());
    if (!key || !value) {
        throw new Error('Invalid header format.');
    }
    return { key, value };
}

/**
 * Decode the given string into a configuration object.
 * @param encoded a base64 encoded string configuration payload
 * @returns deserialized configuration object
 */
export function decodeConfig(encoded: string): Config {
    const decoded = atob(encoded);
    try {
        return JSON.parse(decoded) as Config;
    } catch (error) {
        throw new Error('Invalid configuration');
    }
}

/**
 * Prompt the user for an HTTP header value that matches the given pattern.
 * @param pattern a regex pattern for HTTP headers
 * @returns
 */
export function promptForValidHeader(pattern: string): string {
    const regex = new RegExp(pattern);
    let header: string | null = null;

    while (!header) {
        const input = prompt(
            `Enter a header that matches pattern:\n${pattern}`
        );
        if (!input) {
            alert('No input provided.');
            continue;
        }
        if (!regex.test(input)) {
            alert('Input does not match the required pattern.');
            continue;
        }
        header = input;
    }

    return header;
}

function setHeaderRule(header: string) {
    let key: string, value: string;

    try {
        ({ key, value } = parseHeader(header));
    } catch (err) {
        alert((err as Error).message);
        return;
    }

    const rules = [
        {
            id: 1,
            priority: 1,
            action: {
                type: chrome.declarativeNetRequest.RuleActionType
                    .MODIFY_HEADERS,
                requestHeaders: [
                    {
                        header: key.trim(),
                        operation:
                            chrome.declarativeNetRequest.HeaderOperation.SET,
                        value: value.trim(),
                    },
                ],
            },
            condition: {
                urlFilter: '|', // Apply to all URLs
                resourceTypes: [
                    chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
                    chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
                    chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
                ],
            },
        },
    ];

    // remove all existing rules and add new ones
    chrome.declarativeNetRequest.getDynamicRules((existingRules) => {
        chrome.declarativeNetRequest.updateDynamicRules(
            {
                removeRuleIds: rules
                    .map(({ id }) => id)
                    .concat(existingRules.map((rule) => rule.id)),
                addRules: rules,
            },
            () => {
                if (chrome.runtime.lastError) {
                    console.error(
                        'Failed to set header:',
                        chrome.runtime.lastError.message
                    );
                } else {
                    console.log('Header rule set successfully.');
                    refreshIconIndicator(rules.length);
                }
            }
        );
    });
}

// Listener for the configuration link page
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(location.search);
    const encoded = params.get('payload');

    if (!encoded) {
        alert(
            'Configuration data missing, please make sure to copy the complete link.'
        );
        return;
    }

    const contentDiv = document.getElementById('content');
    if (!contentDiv) return;

    let config: Config;
    try {
        config = decodeConfig(encoded);
    } catch (err) {
        alert((err as Error).message);
        return;
    }

    if (!config.header_filter) {
        console.error('no header filter in the config');
        return;
    }

    const header = isRegex(config.header_filter)
        ? promptForValidHeader(config.header_filter)
        : config.header_filter;

    setHeaderRule(header);
    alert('Header set successfully!');
});

export type Config = {
    header_filter: string;
};
