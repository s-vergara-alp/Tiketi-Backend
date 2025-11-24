require('dotenv').config();
const https = require('https');
const { v4: uuidv4 } = require('uuid');

const API_BASE_URL = process.env.API_BASE_URL || 'https://tiketi-backend.onrender.com/api';

const festivals = [
    {
        name: 'Rock al Parque',
        description: 'One of the largest free rock festivals in Latin America, featuring 56 bands including local, national, and international acts.',
        venue: 'Parque Metropolitano Simón Bolívar',
        startDate: '2025-06-15T10:00:00Z',
        endDate: '2025-06-17T23:00:00Z',
        latitude: 4.6486,
        longitude: -74.0836,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
        primaryColor: '#FF6B35',
        secondaryColor: '#004E89',
        accentColor: '#FFA500',
        backgroundColor: '#1A1A1A',
        decorationIcons: JSON.stringify(['🎸', '🎤', '🥁', '🎵'])
    },
    {
        name: 'Festival Estéreo Picnic',
        description: 'Major music festival showcasing rock, electronic, pop, and alternative music with over 70 artists.',
        venue: 'Parque Simón Bolívar',
        startDate: '2025-03-27T10:00:00Z',
        endDate: '2025-03-30T23:00:00Z',
        latitude: 4.6486,
        longitude: -74.0836,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
        primaryColor: '#00D4FF',
        secondaryColor: '#FF006E',
        accentColor: '#FFBE0B',
        backgroundColor: '#0A0A0A',
        decorationIcons: JSON.stringify(['🎧', '🎹', '🎪', '✨'])
    },
    {
        name: 'Hip Hop al Parque',
        description: 'One of the most significant hip-hop festivals in Latin America, celebrating rap, breakdance, DJing, and graffiti.',
        venue: 'Parque Metropolitano Simón Bolívar',
        startDate: '2025-08-20T12:00:00Z',
        endDate: '2025-08-22T23:00:00Z',
        latitude: 4.6486,
        longitude: -74.0836,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
        primaryColor: '#FFD700',
        secondaryColor: '#000000',
        accentColor: '#FF1493',
        backgroundColor: '#1C1C1C',
        decorationIcons: JSON.stringify(['🎤', '💿', '🎨', '🔥'])
    },
    {
        name: 'Salsa al Parque',
        description: 'Celebrating salsa music with renowned artists from Colombia and Latin America.',
        venue: 'Parque Simón Bolívar',
        startDate: '2025-10-04T14:00:00Z',
        endDate: '2025-10-05T23:00:00Z',
        latitude: 4.6486,
        longitude: -74.0836,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
        primaryColor: '#FF4500',
        secondaryColor: '#FFD700',
        accentColor: '#FF6347',
        backgroundColor: '#2F2F2F',
        decorationIcons: JSON.stringify(['🎺', '🎷', '🥁', '💃'])
    }
];

const users = [
    {
        username: 'admin',
        email: 'admin@tiikii.com',
        password: 'admin123',
        firstName: 'Admin',
        lastName: 'User',
        phone: '+57 300 000 0000',
        dateOfBirth: '1990-01-01',
        isAdmin: true
    },
    {
        username: 'juan_perez',
        email: 'juan.perez@example.com',
        password: 'password123',
        firstName: 'Juan',
        lastName: 'Pérez',
        phone: '+57 300 123 4567',
        dateOfBirth: '1995-05-15',
        isAdmin: false
    },
    {
        username: 'maria_garcia',
        email: 'maria.garcia@example.com',
        password: 'password123',
        firstName: 'María',
        lastName: 'García',
        phone: '+57 300 987 6543',
        dateOfBirth: '1998-08-22',
        isAdmin: false
    }
];

const artists = [
    { name: 'Olivia Rodrigo', genre: 'Pop', bio: 'Grammy-winning pop sensation known for emotional ballads and powerful performances.' },
    { name: 'Justin Timberlake', genre: 'Pop', bio: 'Multi-platinum artist and former NSYNC member with decades of hits.' },
    { name: 'Alanis Morissette', genre: 'Rock', bio: 'Iconic Canadian singer-songwriter known for Jagged Little Pill.' },
    { name: 'Los Aterciopelados', genre: 'Rock', bio: 'Influential Colombian rock band blending traditional and modern sounds.' },
    { name: 'Aterciopelados', genre: 'Alternative', bio: 'Pioneering Colombian alternative rock band.' },
    { name: 'Systema Solar', genre: 'Electronic', bio: 'Colombian electronic music collective known for energetic live shows.' },
    { name: 'Bomba Estéreo', genre: 'Electronic', bio: 'Colombian electronic band fusing cumbia, reggae, and electronic music.' },
    { name: 'J Balvin', genre: 'Reggaeton', bio: 'Colombian reggaeton superstar and global music icon.' },
    { name: 'Maluma', genre: 'Reggaeton', bio: 'Colombian reggaeton and Latin trap artist with international acclaim.' },
    { name: 'La Sonora Ponceña', genre: 'Salsa', bio: 'Legendary Puerto Rican salsa orchestra with over 50 years of history.' },
    { name: 'Yuri Buenaventura', genre: 'Salsa', bio: 'Colombian salsa singer known for his powerful voice and stage presence.' },
    { name: 'Manolito Simonet y su Trabuco', genre: 'Salsa', bio: 'Cuban timba and salsa band with infectious rhythms.' },
    { name: 'Residente', genre: 'Hip Hop', bio: 'Puerto Rican rapper and former Calle 13 member, known for socially conscious lyrics.' },
    { name: 'Ana Tijoux', genre: 'Hip Hop', bio: 'Chilean-French rapper and singer known for her powerful flow.' },
    { name: 'Canserbero', genre: 'Hip Hop', bio: 'Venezuelan rapper known for deep, introspective lyrics.' }
];

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function makeRequest(method, endpoint, data = null, token = null) {
    return new Promise((resolve) => {
        const url = new URL(`${API_BASE_URL}${endpoint}`);
        const options = {
            hostname: url.hostname,
            port: url.port || 443,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => {
                body += chunk;
            });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve({ success: true, data: parsed });
                    } else {
                        resolve({ success: false, error: parsed });
                    }
                } catch (e) {
                    resolve({ success: false, error: body });
                }
            });
        });

        req.on('error', (error) => {
            console.error(`Request error: ${error.message}`);
            resolve({ success: false, error: error.message });
        });

        if (data) {
            req.write(JSON.stringify(data));
        }

        req.end();
    });
}

async function createUser(userData) {
    console.log(`Creating user via API: ${userData.username}...`);
    
    const result = await makeRequest('POST', '/auth/register', {
        username: userData.username,
        email: userData.email,
        password: userData.password,
        firstName: userData.firstName,
        lastName: userData.lastName,
        phone: userData.phone,
        dateOfBirth: userData.dateOfBirth
    });
    
    if (result.success && result.data.user) {
        console.log(`✅ User ${userData.username} created successfully via API`);
        return { ...result.data.user, password: userData.password, isAdmin: userData.isAdmin };
    } else {
        console.log(`❌ Failed to create user ${userData.username}:`, result.error);
        return null;
    }
}

async function loginUser(email, password) {
    console.log(`Logging in user: ${email}...`);
    const result = await makeRequest('POST', '/auth/login', { email, password });
    
    if (result.success && result.data.token) {
        console.log(`✅ User ${email} logged in successfully`);
        return result.data.token;
    } else {
        console.log(`❌ Failed to login user ${email}`);
        return null;
    }
}

async function getFestivals(token) {
    const result = await makeRequest('GET', '/festivals', null, token);
    if (result.success && Array.isArray(result.data)) {
        return result.data;
    }
    return [];
}

async function createFestival(festivalData, token) {
    // Check if festival already exists
    const existingFestivals = await getFestivals(token);
    const existing = existingFestivals.find(f => f.name === festivalData.name);
    if (existing) {
        console.log(`✅ Festival ${festivalData.name} already exists, using existing`);
        return existing;
    }
    
    console.log(`Creating festival via API: ${festivalData.name}...`);
    
    const decorationIcons = typeof festivalData.decorationIcons === 'string' 
        ? JSON.parse(festivalData.decorationIcons) 
        : festivalData.decorationIcons;
    
    const result = await makeRequest('POST', '/festivals', {
        name: festivalData.name,
        description: festivalData.description,
        venue: festivalData.venue,
        startDate: festivalData.startDate,
        endDate: festivalData.endDate,
        latitude: festivalData.latitude,
        longitude: festivalData.longitude,
        latitudeDelta: festivalData.latitudeDelta,
        longitudeDelta: festivalData.longitudeDelta,
        primaryColor: festivalData.primaryColor,
        secondaryColor: festivalData.secondaryColor,
        accentColor: festivalData.accentColor,
        backgroundColor: festivalData.backgroundColor,
        decorationIcons: decorationIcons,
        logo: null,
        bleEnabled: true,
        biometricEnabled: true
    }, token);
    
    if (result.success && result.data.festival) {
        console.log(`✅ Festival ${festivalData.name} created successfully`);
        return result.data.festival;
    } else {
        console.log(`❌ Failed to create festival ${festivalData.name}:`, result.error);
        return null;
    }
}

async function createArtist(artistData, token) {
    console.log(`Creating artist via API: ${artistData.name}...`);
    
    const payload = {
        name: artistData.name,
        bio: artistData.bio,
        genre: artistData.genre,
        socialMedia: artistData.socialMedia || {}
    };
    
    // Only include imageUrl if it's a valid URL
    if (artistData.imageUrl && artistData.imageUrl.startsWith('http')) {
        payload.imageUrl = artistData.imageUrl;
    }
    
    const result = await makeRequest('POST', '/artists', payload, token);
    
    if (result.success && result.data.artist) {
        console.log(`✅ Artist ${artistData.name} created successfully`);
        return result.data.artist;
    } else {
        console.log(`❌ Failed to create artist ${artistData.name}:`, result.error);
        return null;
    }
}

async function getArtists(token) {
    console.log('Fetching existing artists...');
    const result = await makeRequest('GET', '/artists', null, token);
    if (result.success && result.data.artists) {
        return result.data.artists;
    }
    return [];
}

async function getFestivalStages(festivalId, token) {
    const result = await makeRequest('GET', `/festivals/${festivalId}`, null, token);
    if (result.success && result.data.stages) {
        return result.data.stages;
    }
    return [];
}

async function createStage(stageData, token) {
    // Check if stage already exists for this festival
    const existingStages = await getFestivalStages(stageData.festivalId, token);
    const existing = existingStages.find(s => s.name === stageData.name && s.festival_id === stageData.festivalId);
    if (existing) {
        console.log(`✅ Stage ${stageData.name} already exists for festival, using existing`);
        return existing;
    }
    
    console.log(`Creating stage via API: ${stageData.name}...`);
    
    const result = await makeRequest('POST', `/festivals/${stageData.festivalId}/stages`, {
        name: stageData.name,
        description: stageData.description,
        latitude: stageData.latitude,
        longitude: stageData.longitude,
        capacity: stageData.capacity
    }, token);
    
    if (result.success && result.data.stage) {
        console.log(`✅ Stage ${stageData.name} created successfully`);
        return result.data.stage;
    } else {
        console.log(`❌ Failed to create stage ${stageData.name}:`, result.error);
        return null;
    }
}

async function getFestivalSchedule(festivalId, token) {
    const result = await makeRequest('GET', `/schedule/festival/${festivalId}`, null, token);
    if (result.success && result.data.schedule) {
        return result.data.schedule;
    }
    return [];
}

async function createSchedule(scheduleData, token) {
    // Check if schedule entry already exists (same artist, stage, and time)
    const existingSchedule = await getFestivalSchedule(scheduleData.festivalId, token);
    const existing = existingSchedule.find(s => 
        s.artist_id === scheduleData.artistId &&
        s.stage_id === scheduleData.stageId &&
        s.start_time === scheduleData.startTime
    );
    if (existing) {
        console.log(`✅ Schedule entry already exists, skipping`);
        return existing;
    }
    
    console.log(`Creating schedule entry via API...`);
    
    const result = await makeRequest('POST', '/schedule', {
        festivalId: scheduleData.festivalId,
        artistId: scheduleData.artistId,
        stageId: scheduleData.stageId,
        title: scheduleData.title,
        startTime: scheduleData.startTime,
        endTime: scheduleData.endTime
    }, token);
    
    if (result.success && result.data.schedule) {
        console.log(`✅ Schedule entry created successfully`);
        return result.data.schedule;
    } else {
        console.log(`❌ Failed to create schedule entry:`, result.error);
        return null;
    }
}

async function getFestivalTicketTemplates(festivalId, token) {
    const result = await makeRequest('GET', `/tickets/templates/${festivalId}`, null, token);
    if (result.success && Array.isArray(result.data)) {
        return result.data;
    }
    return [];
}

async function createTicketTemplate(templateData, token) {
    // Check if template already exists
    const existingTemplates = await getFestivalTicketTemplates(templateData.festivalId, token);
    const existing = existingTemplates.find(t => t.name === templateData.name && t.festival_id === templateData.festivalId);
    if (existing) {
        console.log(`✅ Ticket template ${templateData.name} already exists, using existing`);
        return existing;
    }
    
    console.log(`Creating ticket template via API: ${templateData.name}...`);
    
    const result = await makeRequest('POST', '/tickets/templates', {
        festivalId: templateData.festivalId,
        name: templateData.name,
        description: templateData.description,
        price: templateData.price,
        currency: templateData.currency || 'USD',
        benefits: templateData.benefits || [],
        maxQuantity: templateData.maxQuantity || 1000
    }, token);
    
    if (result.success && result.data.template) {
        console.log(`✅ Ticket template ${templateData.name} created successfully`);
        return result.data.template;
    } else {
        console.log(`❌ Failed to create ticket template ${templateData.name}:`, result.error);
        return null;
    }
}

async function purchaseTicket(ticketData, token) {
    console.log(`Purchasing ticket via API...`);
    
    const result = await makeRequest('POST', '/tickets/purchase', ticketData, token);
    
    if (result.success) {
        console.log(`✅ Ticket purchased successfully`);
        return result.data;
    } else {
        console.log(`❌ Failed to purchase ticket:`, result.error);
        return null;
    }
}

async function populateDatabase() {
    console.log('🚀 Starting database population via API...\n');
    console.log(`Target API: ${API_BASE_URL}\n`);
    
    try {
        const createdUsers = [];
        const userTokens = [];
        const createdFestivals = [];
        const createdArtists = [];
        const createdStages = {};
        const createdTemplates = {};

        console.log('=== STEP 1: Creating/Verifying Users via API ===\n');
        for (const userData of users) {
            const user = await createUser(userData);
            if (user) {
                createdUsers.push(user);
            } else {
                console.log(`⚠️  User ${userData.username} may already exist. Will try to log in...`);
                createdUsers.push({ ...userData, id: 'temp', email: userData.email });
            }
            await delay(1000);
        }

        if (createdUsers.length === 0) {
            console.log('❌ No users available. Cannot proceed.');
            return;
        }


        console.log('\n=== STEP 2: Logging in Users ===\n');
        for (const user of createdUsers) {
            const email = user.email || users.find(u => u.username === user.username)?.email;
            const password = user.password || users.find(u => u.username === user.username)?.password;
            
            if (email && password) {
                const token = await loginUser(email, password);
                if (token) {
                    const userProfile = await makeRequest('GET', '/users/profile', null, token);
                    if (userProfile.success) {
                        userTokens.push({ user: { ...user, ...userProfile.data.user }, token });
                    } else {
                        userTokens.push({ user, token });
                    }
                }
            }
            await delay(1000);
        }

        if (userTokens.length === 0) {
            console.log('❌ Could not log in any users. Cannot proceed.');
            return;
        }

        console.log('\n=== Checking and Promoting User to Admin ===\n');
        let adminUser = null;
        let adminTokenEntry = null;
        
        for (const { user, token } of userTokens) {
            const userCheck = await makeRequest('GET', '/users/profile', null, token);
            if (userCheck.success) {
                const userData = userCheck.data.user;
                console.log(`Checking user ${user.username}: is_admin=${userData?.is_admin}, role=${userData?.role}`);
                if (userData?.is_admin || userData?.role === 'admin') {
                    console.log(`✅ Found existing admin user: ${user.username}`);
                    adminUser = { ...user, ...userData };
                    adminTokenEntry = { user: adminUser, token };
                    break;
                }
            }
        }
        
        if (!adminTokenEntry && userTokens.length > 0) {
            const firstUserEntry = userTokens[0];
            const firstUser = firstUserEntry.user;
            const firstToken = firstUserEntry.token;
            
            console.log(`No admin found in logged-in users. Attempting to promote ${firstUser.username} to admin via API...`);
            const promoteResult = await makeRequest('POST', '/users/promote-to-admin', {}, firstToken);
            if (promoteResult.success) {
                console.log(`✅ User ${firstUser.username} promoted to admin successfully`);
                adminUser = firstUser;
                adminTokenEntry = { user: firstUser, token: firstToken };
            } else {
                const errorMsg = promoteResult.error?.message || JSON.stringify(promoteResult.error);
                console.log(`⚠️  Could not promote user to admin: ${errorMsg}`);
                if (errorMsg.includes('already exist')) {
                    console.log(`   An admin user exists but we couldn't identify them.`);
                    console.log(`   Trying to use the first user's token anyway (may work if they are admin)...`);
                    adminUser = firstUser;
                    adminTokenEntry = { user: firstUser, token: firstToken };
                }
            }
        }

        const adminToken = adminTokenEntry?.token;

        if (!adminToken) {
            console.log('❌ No admin token available. Cannot create festivals.');
            console.log('   Please ensure an admin user exists and can log in.');
            console.log('   You may need to manually set a user as admin in the database.');
            return;
        }

        console.log(`✅ Using admin token for: ${adminUser?.username || adminTokenEntry?.user?.username || 'admin'}\n`);

        console.log('\n=== STEP 3: Creating/Fetching Festivals via API ===\n');
        
        for (const festivalData of festivals) {
            const festival = await createFestival(festivalData, adminToken);
            if (festival) {
                createdFestivals.push(festival);
            }
            await delay(500);
        }

        if (createdFestivals.length === 0) {
            console.log('❌ No festivals available. Cannot proceed.');
            console.log('⚠️  No festivals created or found. Skipping remaining steps that require festivals.\n');
            console.log('✅ User creation completed successfully!');
            console.log(`\nSummary:`);
            console.log(`- Users created: ${createdUsers.length}`);
            console.log(`\nTest Users (you can now log in with these):`);
            createdUsers.forEach(user => {
                console.log(`  - ${user.username} (${user.email}) - Password: password123`);
            });
            return;
        }

        console.log('\n=== STEP 4: Creating/Fetching Artists via API ===\n');
        // First, try to get existing artists
        const existingArtists = await getArtists(adminToken);
        console.log(`Found ${existingArtists.length} existing artists`);
        
        // Create new artists that don't exist
        for (const artistData of artists) {
            // Check if artist already exists
            const existing = existingArtists.find(a => a.name === artistData.name);
            if (existing) {
                console.log(`✅ Artist ${artistData.name} already exists, using existing`);
                createdArtists.push(existing);
                continue;
            }
            
            const socialMedia = {
                instagram: `@${artistData.name.toLowerCase().replace(/\s+/g, '')}`,
                twitter: `@${artistData.name.toLowerCase().replace(/\s+/g, '')}`
            };
            const artist = await createArtist({ ...artistData, socialMedia }, adminToken);
            if (artist) {
                createdArtists.push(artist);
            }
            await delay(500);
        }
        
        // If we still don't have artists, use existing ones
        if (createdArtists.length === 0 && existingArtists.length > 0) {
            console.log(`⚠️  No new artists created, using ${existingArtists.length} existing artists`);
            createdArtists.push(...existingArtists.slice(0, 8));
        }

        console.log('\n=== STEP 5: Creating/Fetching Stages via API ===\n');
        const stageNames = ['Main Stage', 'Electronic Stage', 'Rock Stage', 'Hip Hop Stage', 'Salsa Stage'];
        
        for (const festival of createdFestivals) {
            // Get existing stages first
            const existingStages = await getFestivalStages(festival.id, adminToken);
            createdStages[festival.id] = [...existingStages];
            const numStages = Math.min(3, stageNames.length);
            
            for (let i = 0; i < numStages; i++) {
                // Check if stage already exists
                const existing = existingStages.find(s => s.name === stageNames[i]);
                if (existing) {
                    console.log(`✅ Stage ${stageNames[i]} already exists for ${festival.name}, using existing`);
                    if (!createdStages[festival.id].find(s => s.id === existing.id)) {
                        createdStages[festival.id].push(existing);
                    }
                    continue;
                }
                
                const stageData = {
                    festivalId: festival.id,
                    name: stageNames[i],
                    description: `${stageNames[i]} at ${festival.name}`,
                    latitude: festival.latitude + (Math.random() - 0.5) * 0.005,
                    longitude: festival.longitude + (Math.random() - 0.5) * 0.005,
                    capacity: Math.floor(Math.random() * 5000) + 1000
                };
                
                const stage = await createStage(stageData, adminToken);
                if (stage) {
                    createdStages[festival.id].push(stage);
                }
                await delay(500);
            }
        }

        console.log('\n=== STEP 6: Creating Schedule via API ===\n');
        for (const festival of createdFestivals) {
            const festivalStart = new Date(festival.start_date || festival.startDate);
            const festivalEnd = new Date(festival.end_date || festival.endDate);
            const stages = createdStages[festival.id] || [];
            
            if (stages.length === 0) continue;

            const artistsForFestival = createdArtists.slice(0, Math.min(8, createdArtists.length));
            
            for (let day = 0; day < 3; day++) {
                const currentDate = new Date(festivalStart);
                currentDate.setDate(currentDate.getDate() + day);
                currentDate.setHours(12, 0, 0, 0);

                let currentTime = new Date(currentDate);
                
                for (let i = 0; i < artistsForFestival.length; i++) {
                    const artist = artistsForFestival[i];
                    const stage = stages[i % stages.length];
                    
                    const startTime = new Date(currentTime);
                    const endTime = new Date(startTime);
                    endTime.setHours(endTime.getHours() + 1);

                    if (endTime > festivalEnd) break;

                    const scheduleData = {
                        festivalId: festival.id,
                        artistId: artist.id,
                        stageId: stage.id,
                        title: `${artist.name} Performance`,
                        startTime: startTime.toISOString(),
                        endTime: endTime.toISOString()
                    };

                    await createSchedule(scheduleData, adminToken);
                    await delay(300);

                    currentTime = new Date(endTime);
                    currentTime.setMinutes(currentTime.getMinutes() + 30);
                }
            }
        }

        console.log('\n=== STEP 7: Creating Ticket Templates via API ===\n');
        const ticketTypes = [
            { name: 'General Admission', price: 50, benefits: ['Access to all stages', 'General admission area'] },
            { name: 'VIP', price: 150, benefits: ['VIP area access', 'Priority entry', 'Complimentary drinks'] },
            { name: 'Early Bird', price: 35, benefits: ['Access to all stages', 'Early entry'] }
        ];

        for (const festival of createdFestivals) {
            createdTemplates[festival.id] = [];
            
            for (const ticketType of ticketTypes) {
                const templateData = {
                    festivalId: festival.id,
                    name: ticketType.name,
                    description: `${ticketType.name} ticket for ${festival.name}`,
                    price: ticketType.price,
                    currency: 'USD',
                    benefits: ticketType.benefits,
                    maxQuantity: 1000
                };

                const template = await createTicketTemplate(templateData, adminToken);
                if (template) {
                    createdTemplates[festival.id].push(template);
                }
                await delay(500);
            }
        }

        console.log('\n=== STEP 8: Creating Tickets via API ===\n');
        if (userTokens.length > 0 && createdFestivals.length > 0) {
            for (let i = 0; i < userTokens.length; i++) {
                const { user, token } = userTokens[i];
                
                const festival = createdFestivals[0];
                const templates = createdTemplates[festival.id] || [];
                
                if (templates.length > 0) {
                    const template = templates[0];
                    
                    const ticketData = {
                        festivalId: festival.id,
                        templateId: template.id,
                        holderName: `${user.first_name || user.firstName} ${user.last_name || user.lastName}`,
                        paymentMethod: {
                            type: 'credit_card', // Valid payment method type
                            token: 'test_token_' + uuidv4()
                        },
                        amount: template.price,
                        currency: 'USD'
                    };

                    await purchaseTicket(ticketData, token);
                    await delay(1000);
                }

                if (templates.length > 1 && createdFestivals.length > 1) {
                    const secondFestival = createdFestivals[1];
                    const secondTemplates = createdTemplates[secondFestival.id] || [];
                    
                    if (secondTemplates.length > 0) {
                        const template = secondTemplates[1];
                        
                        const ticketData = {
                            festivalId: secondFestival.id,
                            templateId: template.id,
                            holderName: `${user.first_name || user.firstName} ${user.last_name || user.lastName}`,
                            paymentMethod: {
                                type: 'credit_card', // Valid payment method type
                                token: 'test_token_' + uuidv4()
                            },
                            amount: template.price,
                            currency: 'USD'
                        };

                        await purchaseTicket(ticketData, token);
                        await delay(1000);
                    }
                }
            }
        } else {
            console.log('Skipping ticket creation (no logged-in users or festivals).\n');
        }

        console.log('\n=== STEP 9: Creating Vendors via API ===\n');
        for (const festival of createdFestivals) {
            // Get existing vendors for this festival
            const existingVendorsResult = await makeRequest('GET', `/vendors/festival/${festival.id}`, null, adminToken);
            const existingVendors = existingVendorsResult.success && existingVendorsResult.data.vendors 
                ? existingVendorsResult.data.vendors 
                : [];
            
            const vendors = [
                { name: 'Food Court', type: 'food', latitude: festival.latitude + 0.001, longitude: festival.longitude + 0.001 },
                { name: 'Bar Central', type: 'drink', latitude: festival.latitude - 0.001, longitude: festival.longitude + 0.001 },
                { name: 'Merchandise Stand', type: 'merch', latitude: festival.latitude + 0.001, longitude: festival.longitude - 0.001 }
            ];

            for (const vendor of vendors) {
                // Check if vendor already exists
                const existing = existingVendors.find(v => v.name === vendor.name && v.festival_id === festival.id);
                if (existing) {
                    console.log(`✅ Vendor ${vendor.name} already exists, skipping`);
                    continue;
                }
                
                const result = await makeRequest('POST', '/vendors', {
                    festivalId: festival.id,
                    name: vendor.name,
                    type: vendor.type,
                    description: `${vendor.name} at ${festival.name}`,
                    latitude: vendor.latitude,
                    longitude: vendor.longitude,
                    hours: '10:00-23:00',
                    rating: parseFloat((Math.random() * 2 + 3).toFixed(1)),
                    waitTime: Math.floor(Math.random() * 15) + 5
                }, adminToken);
                
                if (result.success) {
                    console.log(`✅ Vendor ${vendor.name} created`);
                } else {
                    console.log(`❌ Failed to create vendor ${vendor.name}:`, result.error);
                }
                await delay(500);
            }
        }

        console.log('\n=== STEP 10: Creating POIs via API ===\n');
        for (const festival of createdFestivals) {
            // Get existing POIs for this festival
            const existingPOIsResult = await makeRequest('GET', `/pois/festival/${festival.id}`, null, adminToken);
            const existingPOIs = existingPOIsResult.success && existingPOIsResult.data.pois 
                ? existingPOIsResult.data.pois 
                : [];
            
            const pois = [
                { name: 'Main Entrance', kind: 'entrance', latitude: festival.latitude, longitude: festival.longitude - 0.002 },
                { name: 'Medical Tent', kind: 'medic', latitude: festival.latitude - 0.002, longitude: festival.longitude },
                { name: 'Information Booth', kind: 'info', latitude: festival.latitude + 0.002, longitude: festival.longitude },
                { name: 'Water Station', kind: 'water', latitude: festival.latitude, longitude: festival.longitude + 0.002 }
            ];

            for (const poi of pois) {
                // Check if POI already exists
                const existing = existingPOIs.find(p => p.name === poi.name && p.festival_id === festival.id);
                if (existing) {
                    console.log(`✅ POI ${poi.name} already exists, skipping`);
                    continue;
                }
                
                const result = await makeRequest('POST', '/pois', {
                    festivalId: festival.id,
                    name: poi.name,
                    kind: poi.kind,
                    description: `${poi.name} at ${festival.name}`,
                    latitude: poi.latitude,
                    longitude: poi.longitude
                }, adminToken);
                
                if (result.success) {
                    console.log(`✅ POI ${poi.name} created`);
                } else {
                    console.log(`❌ Failed to create POI ${poi.name}:`, result.error);
                }
                await delay(500);
            }
        }

        console.log('\n✅ Database population completed!');
        console.log(`\nSummary:`);
        console.log(`- Users created via API: ${createdUsers.length}`);
        console.log(`- Festivals created: ${createdFestivals.length}`);
        console.log(`- Artists created: ${createdArtists.length}`);
        console.log(`- Tickets created: ${userTokens.length > 0 ? userTokens.length * 2 : 0}`);
        console.log(`\nTest Users (you can now log in with these):`);
        createdUsers.forEach(user => {
            const password = user.isAdmin ? 'admin123' : 'password123';
            const role = user.isAdmin ? ' [ADMIN]' : '';
            console.log(`  - ${user.username} (${user.email})${role} - Password: ${password}`);
        });

    } catch (error) {
        console.error('❌ Error during database population:', error);
        throw error;
    }
}

populateDatabase().catch(console.error);

