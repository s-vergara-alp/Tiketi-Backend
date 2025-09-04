const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// Use environment variable for database path, fallback to default
const dbPath = process.env.DB_PATH || path.join(__dirname, '../../database/tiikii_festival.db');

// Create database connection
const db = new sqlite3.Database(dbPath);

console.log('Starting database seeding...');

// Helper function to run queries
const runQuery = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(query, params, function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this);
            }
        });
    });
};

// Helper function to get results
const getResults = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
};

async function seedDatabase() {
    try {
        // Create test user
        const hashedPassword = await bcrypt.hash('password123', 10);
        const userId = uuidv4();
        
        await runQuery(`
            INSERT INTO users (id, username, email, password_hash, first_name, last_name, avatar, is_verified)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [userId, 'testuser', 'test@example.com', hashedPassword, 'Carlos', 'Rodríguez', '👤', 1]);

        // Create festivals
        const festivals = [
            {
                id: 'cordillera-2025',
                name: 'Festival de la Cordillera 2025',
                description: 'El Festival Cordillera 2025 con el tema "El futuro es latino" celebra la música, el arte y la cultura latina en el corazón de Bogotá.',
                logo: '🏔️',
                venue: 'Parque Metropolitano Simón Bolívar, Bogotá',
                start_date: '2025-09-13 14:00:00',
                end_date: '2025-09-14 23:00:00',
                latitude: 4.6682,
                longitude: -74.0951,
                latitude_delta: 0.01,
                longitude_delta: 0.01,
                primary_color: '#FF6B35',
                secondary_color: '#2E86AB',
                accent_color: '#A23B72',
                background_color: '#F8F9FA',
                decoration_icons: JSON.stringify(['🌿', '🎵', '🎨', '🍃', '⛰️', '🎭', '🇨🇴', '🎪'])
            },
            {
                id: 'tiikii-2024',
                name: 'Tiikii Festival 2024',
                description: 'The ultimate electronic music festival experience with world-class DJs and immersive art installations.',
                logo: '🎵',
                venue: 'Golden Gate Park, San Francisco',
                start_date: '2024-07-15 12:00:00',
                end_date: '2024-07-17 23:00:00',
                latitude: 37.78825,
                longitude: -122.4324,
                latitude_delta: 0.0922,
                longitude_delta: 0.0421,
                primary_color: '#FF4DA6',
                secondary_color: '#4DA3FF',
                accent_color: '#4BE16D',
                background_color: '#FAFAFA',
                decoration_icons: JSON.stringify(['🎶', '🎤', '🎧', '🎸', '🥁', '🎹'])
            }
        ];

        for (const festival of festivals) {
            await runQuery(`
                INSERT INTO festivals (id, name, description, logo, venue, start_date, end_date, 
                                     latitude, longitude, latitude_delta, longitude_delta,
                                     primary_color, secondary_color, accent_color, background_color, decoration_icons)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [festival.id, festival.name, festival.description, festival.logo, festival.venue,
                festival.start_date, festival.end_date, festival.latitude, festival.longitude,
                festival.latitude_delta, festival.longitude_delta, festival.primary_color,
                festival.secondary_color, festival.accent_color, festival.background_color,
                festival.decoration_icons]);
        }

        // Create artists
        const artists = [
            {
                id: uuidv4(),
                name: 'Fito Páez',
                bio: 'Legendary Argentine rock musician and songwriter',
                genre: 'Rock Latino',
                image_url: 'https://example.com/fito-paez.jpg',
                social_media: JSON.stringify({
                    instagram: '@fitopaez',
                    twitter: '@fitopaez',
                    facebook: 'FitoPaezOficial'
                })
            },
            {
                id: uuidv4(),
                name: 'Carlos Vives',
                bio: 'Colombian singer, composer and actor known as the King of Vallenato',
                genre: 'Vallenato',
                image_url: 'https://example.com/carlos-vives.jpg',
                social_media: JSON.stringify({
                    instagram: '@carlosvives',
                    twitter: '@carlosvives',
                    facebook: 'CarlosVivesOficial'
                })
            },
            {
                id: uuidv4(),
                name: 'Bomba Estéreo',
                bio: 'Colombian electronic music band from Bogotá',
                genre: 'Electronica',
                image_url: 'https://example.com/bomba-estereo.jpg',
                social_media: JSON.stringify({
                    instagram: '@bombaestereo',
                    twitter: '@bombaestereo',
                    facebook: 'BombaEstereoOficial'
                })
            },
            {
                id: uuidv4(),
                name: 'Los Auténticos Decadentes',
                bio: 'Argentine rock band with Latin American influence',
                genre: 'Rock Latino',
                image_url: 'https://example.com/autenticos-decadentes.jpg',
                social_media: JSON.stringify({
                    instagram: '@autenticosdecadentes',
                    twitter: '@autenticosdec',
                    facebook: 'AutenticosDecadentesOficial'
                })
            }
        ];

        for (const artist of artists) {
            await runQuery(`
                INSERT INTO artists (id, name, bio, genre, image_url, social_media)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [artist.id, artist.name, artist.bio, artist.genre, artist.image_url, artist.social_media]);
        }

        // Create stages
        const stages = [
            {
                id: uuidv4(),
                festival_id: 'cordillera-2025',
                name: 'Escenario Principal',
                description: 'Main stage with capacity for 50,000 people',
                latitude: 4.6682,
                longitude: -74.0951,
                capacity: 50000
            },
            {
                id: uuidv4(),
                festival_id: 'cordillera-2025',
                name: 'Escenario Secundario',
                description: 'Secondary stage for emerging artists',
                latitude: 4.6692,
                longitude: -74.0941,
                capacity: 15000
            }
        ];

        for (const stage of stages) {
            await runQuery(`
                INSERT INTO stages (id, festival_id, name, description, latitude, longitude, capacity)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [stage.id, stage.festival_id, stage.name, stage.description, stage.latitude, stage.longitude, stage.capacity]);
        }

        // Get stage IDs for schedule
        const stageResults = await getResults('SELECT id, name FROM stages WHERE festival_id = ?', ['cordillera-2025']);
        const mainStage = stageResults.find(s => s.name === 'Escenario Principal');
        const secondaryStage = stageResults.find(s => s.name === 'Escenario Secundario');

        // Create schedule
        const schedule = [
            {
                id: uuidv4(),
                festival_id: 'cordillera-2025',
                artist_id: artists[0].id, // Fito Páez
                stage_id: mainStage.id,
                title: 'Fito Páez en Vivo',
                start_time: '2025-09-13 18:30:00',
                end_time: '2025-09-13 20:00:00'
            },
            {
                id: uuidv4(),
                festival_id: 'cordillera-2025',
                artist_id: artists[1].id, // Carlos Vives
                stage_id: mainStage.id,
                title: 'Carlos Vives - El Rey del Vallenato',
                start_time: '2025-09-13 20:00:00',
                end_time: '2025-09-13 21:30:00'
            },
            {
                id: uuidv4(),
                festival_id: 'cordillera-2025',
                artist_id: artists[2].id, // Bomba Estéreo
                stage_id: mainStage.id,
                title: 'Bomba Estéreo - Electrónica Colombiana',
                start_time: '2025-09-13 21:30:00',
                end_time: '2025-09-13 23:00:00'
            }
        ];

        for (const slot of schedule) {
            await runQuery(`
                INSERT INTO schedule (id, festival_id, artist_id, stage_id, title, start_time, end_time)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [slot.id, slot.festival_id, slot.artist_id, slot.stage_id, slot.title, slot.start_time, slot.end_time]);
        }

        // Create ticket templates
        const ticketTemplates = [
            {
                id: uuidv4(),
                festival_id: 'cordillera-2025',
                name: 'VIP Experience',
                description: 'Acceso VIP completo con beneficios exclusivos',
                price: 450000,
                currency: 'COP',
                benefits: JSON.stringify([
                    'Acceso VIP a todos los escenarios',
                    'Área VIP exclusiva con bar premium',
                    'Meet & Greet con artistas',
                    'Merchandise exclusivo',
                    'Acceso prioritario a todas las actividades',
                    'Estacionamiento VIP'
                ]),
                max_quantity: 500,
                current_quantity: 127
            },
            {
                id: uuidv4(),
                festival_id: 'cordillera-2025',
                name: 'Premium Access',
                description: 'Acceso premium con beneficios especiales',
                price: 280000,
                currency: 'COP',
                benefits: JSON.stringify([
                    'Acceso premium a todos los escenarios',
                    'Área premium con bar exclusivo',
                    'Acceso a actividades especiales',
                    'Merchandise premium',
                    'Estacionamiento incluido'
                ]),
                max_quantity: 1000,
                current_quantity: 342
            },
            {
                id: uuidv4(),
                festival_id: 'cordillera-2025',
                name: 'General Access',
                description: 'Acceso general al festival',
                price: 180000,
                currency: 'COP',
                benefits: JSON.stringify([
                    'Acceso general a todos los escenarios',
                    'Acceso a food trucks y bebidas',
                    'Área de descanso',
                    'Acceso a instalaciones básicas'
                ]),
                max_quantity: 5000,
                current_quantity: 2156
            }
        ];

        for (const template of ticketTemplates) {
            await runQuery(`
                INSERT INTO ticket_templates (id, festival_id, name, description, price, currency, benefits, max_quantity, current_quantity)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [template.id, template.festival_id, template.name, template.description, template.price, template.currency, template.benefits, template.max_quantity, template.current_quantity]);
        }

        // Create a ticket for the test user
        const templateId = ticketTemplates[0].id; // VIP template
        const ticketId = uuidv4();
        const qrPayload = `CORDILLERA-2025-VIP-${ticketId.substring(0, 8).toUpperCase()}`;
        
        await runQuery(`
            INSERT INTO tickets (id, user_id, festival_id, template_id, qr_payload, holder_name, tier, valid_from, valid_to, price)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [ticketId, userId, 'cordillera-2025', templateId, qrPayload, 'Carlos Rodríguez', 'VIP', '2025-09-13 14:00:00', '2025-09-14 23:59:59', 450000]);

        // Create chat rooms
        const chatRooms = [
            {
                id: 'general-cordillera',
                festival_id: 'cordillera-2025',
                name: 'General - Festival de la Cordillera',
                type: 'general',
                avatar: '🏔️',
                created_by: userId
            },
            {
                id: 'friends-maria',
                festival_id: 'cordillera-2025',
                name: 'María González',
                type: 'friends',
                avatar: '👩‍🎨',
                created_by: userId
            }
        ];

        for (const room of chatRooms) {
            await runQuery(`
                INSERT INTO chat_rooms (id, festival_id, name, type, avatar, created_by)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [room.id, room.festival_id, room.name, room.type, room.avatar, room.created_by]);
        }

        // Add user to chat rooms
        for (const room of chatRooms) {
            await runQuery(`
                INSERT INTO chat_participants (room_id, user_id)
                VALUES (?, ?)
            `, [room.id, userId]);
        }

        // Create some sample chat messages
        const messages = [
            {
                id: uuidv4(),
                room_id: 'general-cordillera',
                sender_id: userId,
                text: '¡Hola a todos! ¿Quién está listo para el Festival de la Cordillera?',
                timestamp: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
            },
            {
                id: uuidv4(),
                room_id: 'general-cordillera',
                sender_id: userId,
                text: 'Según el programa, Fito Páez empieza a las 8:30 PM en el escenario principal',
                timestamp: new Date(Date.now() - 1800000).toISOString() // 30 minutes ago
            }
        ];

        for (const message of messages) {
            await runQuery(`
                INSERT INTO chat_messages (id, room_id, sender_id, text, timestamp)
                VALUES (?, ?, ?, ?, ?)
            `, [message.id, message.room_id, message.sender_id, message.text, message.timestamp]);
        }

        // Create widgets
        const widgets = [
            {
                id: 'now-playing',
                festival_id: 'cordillera-2025',
                title: 'Now Playing',
                subtitle: 'Live from Main Stage',
                icon: '🎵',
                type: 'now-playing',
                content: JSON.stringify({
                    artist: 'Fito Páez',
                    song: 'El Amor Después del Amor',
                    stage: 'Escenario Principal - Parque Metropolitano Simón Bolívar',
                    timeRemaining: '45 min',
                    nextArtist: 'Carlos Vives',
                    nextTime: '22:00',
                    stageCapacity: '85%',
                    soundLevel: '95 dB',
                    crowdEnergy: '🔥🔥🔥'
                }),
                is_active: 1,
                is_live: 1,
                priority: 'high',
                customizable: 1,
                order_index: 1
            },
            {
                id: 'weather',
                festival_id: 'cordillera-2025',
                title: 'Weather',
                subtitle: 'Bogotá, Colombia',
                icon: '☀️',
                type: 'weather',
                content: JSON.stringify({
                    temperature: '22°C',
                    condition: 'Soleado',
                    humidity: '65%',
                    windSpeed: '12 km/h',
                    forecast: 'Parcialmente nublado por la tarde - Perfecto para festivales al aire libre',
                    feelsLike: '24°C',
                    visibility: '10 km',
                    uvIndex: 'Moderate'
                }),
                is_active: 1,
                is_live: 0,
                priority: 'medium',
                customizable: 1,
                order_index: 2
            },
            {
                id: 'schedule',
                festival_id: 'cordillera-2025',
                title: 'Schedule',
                subtitle: 'Today\'s lineup',
                icon: '📅',
                type: 'schedule',
                content: JSON.stringify({
                    schedule: [
                        { time: '14:00', artist: 'Apertura de Puertas', stage: 'Entrada Principal' },
                        { time: '15:30', artist: 'Los Auténticos Decadentes', stage: 'Escenario Principal' },
                        { time: '17:00', artist: 'Panteón Rococó', stage: 'Escenario Principal' },
                        { time: '18:30', artist: 'Fito Páez', stage: 'Escenario Principal' },
                        { time: '20:00', artist: 'Carlos Vives', stage: 'Escenario Principal' },
                        { time: '21:30', artist: 'Rubén Blades y Roberto Delgado Big Band', stage: 'Escenario Principal' },
                        { time: '23:00', artist: 'Cierre del Festival', stage: 'Todos los Escenarios' }
                    ]
                }),
                is_active: 1,
                is_live: 0,
                priority: 'medium',
                customizable: 1,
                order_index: 3
            }
        ];

        for (const widget of widgets) {
            await runQuery(`
                INSERT INTO widgets (id, festival_id, title, subtitle, icon, type, content, is_active, is_live, priority, customizable, order_index)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [widget.id, widget.festival_id, widget.title, widget.subtitle, widget.icon, widget.type, widget.content, widget.is_active, widget.is_live, widget.priority, widget.customizable, widget.order_index]);
        }

        // Create vendors
        const vendors = [
            {
                id: uuidv4(),
                festival_id: 'cordillera-2025',
                name: 'Arepas Colombianas',
                type: 'food',
                description: 'Traditional Colombian arepas with various fillings',
                latitude: 4.6685,
                longitude: -74.0955,
                hours: '14:00-23:00',
                rating: 4.8,
                wait_time: 5
            },
            {
                id: uuidv4(),
                festival_id: 'cordillera-2025',
                name: 'Cerveza Artesanal Bogotá',
                type: 'drink',
                description: 'Local craft beer selection',
                latitude: 4.6680,
                longitude: -74.0945,
                hours: '14:00-23:00',
                rating: 4.6,
                wait_time: 2
            }
        ];

        for (const vendor of vendors) {
            await runQuery(`
                INSERT INTO vendors (id, festival_id, name, type, description, latitude, longitude, hours, rating, wait_time)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [vendor.id, vendor.festival_id, vendor.name, vendor.type, vendor.description, vendor.latitude, vendor.longitude, vendor.hours, vendor.rating, vendor.wait_time]);
        }

        // Create points of interest
        const pois = [
            {
                id: uuidv4(),
                festival_id: 'cordillera-2025',
                name: 'Entrada Principal',
                kind: 'entrance',
                description: 'Main festival entrance',
                latitude: 4.6675,
                longitude: -74.0960
            },
            {
                id: uuidv4(),
                festival_id: 'cordillera-2025',
                name: 'Tenda Médica',
                kind: 'medic',
                description: 'Medical tent for first aid and emergencies',
                latitude: 4.6690,
                longitude: -74.0940
            },
            {
                id: uuidv4(),
                festival_id: 'cordillera-2025',
                name: 'Estación de Carga',
                kind: 'charging',
                description: 'Phone charging station',
                latitude: 4.6688,
                longitude: -74.0958
            }
        ];

        for (const poi of pois) {
            await runQuery(`
                INSERT INTO points_of_interest (id, festival_id, name, kind, description, latitude, longitude)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [poi.id, poi.festival_id, poi.name, poi.kind, poi.description, poi.latitude, poi.longitude]);
        }

        console.log('Database seeded successfully!');
        console.log('Test user created:');
        console.log('  Username: testuser');
        console.log('  Email: test@example.com');
        console.log('  Password: password123');

    } catch (error) {
        console.error('Error seeding database:', error);
    } finally {
        db.close((err) => {
            if (err) {
                console.error('Error closing database:', err);
            } else {
                console.log('Database connection closed.');
            }
        });
    }
}

seedDatabase();
