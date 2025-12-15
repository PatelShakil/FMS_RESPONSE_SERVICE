/**
 * Spam Detector Utility
 * Advanced spam detection logic
 */

const Response = require("../models/Response");
const logger = require("./logger");

/**
 * Detect spam based on various factors
 */
const detectSpam = async (responseData) => {
    let spamScore = 0;
    const spamReasons = [];

    try {
        // 1. Check IP-based submission frequency
        if (responseData.device && responseData.device.ipAddress) {
            const recentSubmissions = await Response.findRecentByIP(
                responseData.device.ipAddress,
                1 // Last 1 hour
            );

            if (recentSubmissions.length >= 10) {
                spamScore += 40;
                spamReasons.push("High submission frequency from same IP");
            } else if (recentSubmissions.length >= 5) {
                spamScore += 20;
                spamReasons.push("Multiple submissions from same IP");
            }
        }

        // 2. Check response content
        if (responseData.answers) {
            const textContent = JSON.stringify(responseData.answers).toLowerCase();

            // Very short responses (less than 5 characters)
            if (textContent.length < 5) {
                spamScore += 25;
                spamReasons.push("Extremely short response");
            }

            // Repeated characters (e.g., "aaaaaaaaaa")
            if (/(.)\1{10,}/.test(textContent)) {
                spamScore += 30;
                spamReasons.push("Repeated characters detected");
            }

            // Common spam keywords
            const spamKeywords = [
                "viagra",
                "casino",
                "lottery",
                "click here",
                "buy now",
                "free money",
                "work from home",
                "make money fast",
                "weight loss",
                "enlargement",
                "nigerian prince",
            ];

            const foundSpamKeywords = spamKeywords.filter((keyword) =>
                textContent.includes(keyword)
            );

            if (foundSpamKeywords.length > 0) {
                spamScore += 40;
                spamReasons.push(
                    `Spam keywords detected: ${foundSpamKeywords.join(", ")}`
                );
            }

            // Excessive URLs
            const urlMatches = textContent.match(/https?:\/\/[^\s]+/g);
            if (urlMatches && urlMatches.length > 3) {
                spamScore += 30;
                spamReasons.push("Excessive URLs in response");
            }

            // All caps (at least 20 characters)
            const capsMatches = textContent.match(/[A-Z]{20,}/g);
            if (capsMatches && capsMatches.length > 0) {
                spamScore += 15;
                spamReasons.push("Excessive capitalization");
            }

            // Excessive punctuation
            const punctuationMatches = textContent.match(/[!?]{5,}/g);
            if (punctuationMatches && punctuationMatches.length > 0) {
                spamScore += 15;
                spamReasons.push("Excessive punctuation");
            }
        }

        // 3. Check for duplicate content
        if (responseData.formId && responseData.answers) {
            const textContent = JSON.stringify(responseData.answers);

            // Find similar responses (last 24 hours)
            const recentResponses = await Response.find({
                formId: responseData.formId,
                submittedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
                deletedAt: null,
            })
                .limit(100)
                .lean();

            const duplicates = recentResponses.filter((r) => {
                const existingContent = JSON.stringify(r.answers);
                return existingContent === textContent;
            });

            if (duplicates.length > 0) {
                spamScore += 50;
                spamReasons.push("Duplicate response content detected");
            }
        }

        // 4. Check submission time patterns (unusual hours)
        const submittedHour = new Date(
            responseData.submittedAt || Date.now()
        ).getHours();

        // Submissions between 2 AM - 5 AM (slightly suspicious)
        if (submittedHour >= 2 && submittedHour <= 5) {
            spamScore += 5;
            spamReasons.push("Submission during unusual hours");
        }

        // 5. Check if no user agent (bot)
        if (!responseData.device || !responseData.device.userAgent) {
            spamScore += 20;
            spamReasons.push("No user agent detected (possible bot)");
        }

        // 6. Check for suspicious user agents
        if (responseData.device && responseData.device.userAgent) {
            const suspiciousAgents = [
                "bot",
                "crawler",
                "spider",
                "scraper",
                "curl",
                "wget",
                "python",
            ];

            const userAgent = responseData.device.userAgent.toLowerCase();
            const foundSuspicious = suspiciousAgents.filter((agent) =>
                userAgent.includes(agent)
            );

            if (foundSuspicious.length > 0) {
                spamScore += 35;
                spamReasons.push(
                    `Suspicious user agent: ${foundSuspicious.join(", ")}`
                );
            }
        }

        // Cap spam score at 100
        spamScore = Math.min(spamScore, 100);

        logger.info("Spam detection completed", {
            spamScore,
            isSpam: spamScore >= 75,
            reasons: spamReasons,
        });

        return {
            spamScore,
            isSpam: spamScore >= 75,
            spamReasons,
        };
    } catch (error) {
        logger.error("Error in spam detection:", error);

        // Return safe default
        return {
            spamScore: 0,
            isSpam: false,
            spamReasons: [],
        };
    }
};

/**
 * Check if IP is rate limited
 */
const checkIPRateLimit = async (
    ipAddress,
    maxSubmissions = 10,
    windowHours = 1
) => {
    try {
        const recentSubmissions = await Response.findRecentByIP(
            ipAddress,
            windowHours
        );

        return {
            isLimited: recentSubmissions.length >= maxSubmissions,
            currentCount: recentSubmissions.length,
            maxAllowed: maxSubmissions,
        };
    } catch (error) {
        logger.error("Error checking IP rate limit:", error);
        return {
            isLimited: false,
            currentCount: 0,
            maxAllowed: maxSubmissions,
        };
    }
};

/**
 * Parse device information from user agent
 */
const parseDeviceInfo = (userAgent) => {
    if (!userAgent) {
        return {
            platform: "Unknown",
            browser: "Unknown",
            deviceType: "UNKNOWN",
        };
    }

    const ua = userAgent.toLowerCase();

    // Detect platform
    let platform = "Unknown";
    if (ua.includes("android")) {
        platform = "Android";
    } else if (ua.includes("iphone") || ua.includes("ipad")) {
        platform = "iOS";
    } else if (ua.includes("windows")) {
        platform = "Windows";
    } else if (ua.includes("mac")) {
        platform = "MacOS";
    } else if (ua.includes("linux")) {
        platform = "Linux";
    }

    // Detect browser
    let browser = "Unknown";
    if (ua.includes("chrome") && !ua.includes("edg")) {
        browser = "Chrome";
    } else if (ua.includes("safari") && !ua.includes("chrome")) {
        browser = "Safari";
    } else if (ua.includes("firefox")) {
        browser = "Firefox";
    } else if (ua.includes("edg")) {
        browser = "Edge";
    } else if (ua.includes("opera") || ua.includes("opr")) {
        browser = "Opera";
    }

    // Detect device type
    let deviceType = "DESKTOP";
    if (ua.includes("mobile")) {
        deviceType = "MOBILE";
    } else if (ua.includes("tablet") || ua.includes("ipad")) {
        deviceType = "TABLET";
    }

    return {
        platform,
        browser,
        deviceType,
    };
};

module.exports = {
    detectSpam,
    checkIPRateLimit,
    parseDeviceInfo,
};
