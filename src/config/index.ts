import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

interface Config {
    env: string;
    port: number;
    apiBaseUrl: string;
    database: {
        url: string;
    };
    redis: {
        url: string;
    };
    jwt: {
        secret: string;
        expiresIn: string;
        refreshSecret: string;
        refreshExpiresIn: string;
    };
    email: {
        smtp: {
            host: string;
            port: number;
            user: string;
            password: string;
        };
        from: string;
    };
    oauth: {
        google: {
            clientId: string;
            clientSecret: string;
            redirectUri: string;
        };
        notion: {
            clientId: string;
            clientSecret: string;
            redirectUri: string;
        };
        zoom: {
            clientId: string;
            clientSecret: string;
            redirectUri: string;
        };
    };
    storage: {
        s3: {
            endpoint: string;
            bucket: string;
            accessKey: string;
            secretKey: string;
            region: string;
        };
    };
    ai: {
        openai: string;
        anthropic: string;
        gemini: string;
        model: string;
        temperature: number;
    };
    external: {
        twilio: {
            accountSid: string;
            authToken: string;
            phoneNumber: string;
        };
        zoom: {
            clientId: string;
            clientSecret: string;
        };
        drchrono: {
            clientId: string;
            clientSecret: string;
        };
        doxy: {
            apiKey: string;
        };
    };
    monitoring: {
        sentryDsn: string;
    };
    encryption: {
        key: string;
    };
    features: {
        aiEnabled: boolean;
        telehealthEnabled: boolean;
        pharmacyEnabled: boolean;
        googleEnabled: boolean;
        notionEnabled: boolean;
        zoomEnabled: boolean;
    };
}

export const config: Config = {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '4000', 10),
    apiBaseUrl: process.env.APP_URL || 'http://localhost:4000',

    database: {
        url: process.env.DATABASE_URL || '',
    },

    redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
    },

    jwt: {
        secret: process.env.JWT_SECRET || '',
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
        refreshSecret: process.env.REFRESH_TOKEN_SECRET || '',
        refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d',
    },

    email: {
        smtp: {
            host: process.env.SMTP_HOST || '',
            port: parseInt(process.env.SMTP_PORT || '587', 10),
            user: process.env.SMTP_USER || '',
            password: process.env.SMTP_PASSWORD || '',
        },
        from: process.env.EMAIL_FROM || 'noreply@atlasai.com',
    },

    oauth: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID || '',
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
            redirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI || '',
        },
        notion: {
            clientId: process.env.NOTION_CLIENT_ID || '',
            clientSecret: process.env.NOTION_CLIENT_SECRET || '',
            redirectUri: process.env.NOTION_REDIRECT_URI || '',
        },
        zoom: {
            clientId: process.env.ZOOM_CLIENT_ID || '',
            clientSecret: process.env.ZOOM_CLIENT_SECRET || '',
            redirectUri: process.env.ZOOM_REDIRECT_URI || '',
        }
    },

    storage: {
        s3: {
            endpoint: process.env.S3_ENDPOINT || '',
            bucket: process.env.S3_BUCKET || 'atlas-files',
            accessKey: process.env.S3_ACCESS_KEY || '',
            secretKey: process.env.S3_SECRET_KEY || '',
            region: process.env.S3_REGION || 'us-east-1',
        },
    },

    ai: {
        openai: process.env.OPENAI_API_KEY || '',
        anthropic: process.env.ANTHROPIC_API_KEY || '',
        gemini: process.env.GEMINI_API_KEY || '',
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.2'),
    },

    external: {
        twilio: {
            accountSid: process.env.TWILIO_ACCOUNT_SID || '',
            authToken: process.env.TWILIO_AUTH_TOKEN || '',
            phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
        },
        zoom: {
            clientId: process.env.ZOOM_CLIENT_ID || '',
            clientSecret: process.env.ZOOM_CLIENT_SECRET || '',
        },
        drchrono: {
            clientId: process.env.DRCHRONO_CLIENT_ID || '',
            clientSecret: process.env.DRCHRONO_CLIENT_SECRET || '',
        },
        doxy: {
            apiKey: process.env.DOXY_API_KEY || '',
        },
    },

    monitoring: {
        sentryDsn: process.env.SENTRY_DSN || '',
    },

    encryption: {
        key: process.env.ENCRYPTION_KEY || '',
    },

    features: {
        aiEnabled: true,
        telehealthEnabled: false,
        pharmacyEnabled: false,
        googleEnabled: process.env.ENABLE_GOOGLE === 'true',
        notionEnabled: process.env.ENABLE_NOTION === 'true',
        zoomEnabled: process.env.ENABLE_ZOOM === 'true',
    },
};

// Validate critical configuration
function validateConfig() {
    const errors: string[] = [];

    if (!config.database.url) {
        errors.push('DATABASE_URL is required');
    }

    if (config.env === 'production') {
        if (!config.jwt.secret || config.jwt.secret.length < 32) {
            errors.push('JWT_SECRET must be at least 32 characters in production');
        }
        if (!config.jwt.refreshSecret || config.jwt.refreshSecret.length < 32) {
            errors.push('REFRESH_TOKEN_SECRET must be at least 32 characters in production');
        }
        if (!config.encryption.key || config.encryption.key.length < 32) {
            errors.push('ENCRYPTION_KEY must be at least 32 characters in production');
        }
    }

    if (errors.length > 0) {
        throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }
}

validateConfig();

export default config;
