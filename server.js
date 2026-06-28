require('dotenv').config();

const express = require('express');

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const supabase = require('./supabase');

const app = express();

app.use(express.json());

//************** TokenÜberprüfung ********************************
function authenticateToken(req, res, next) {

    const authHeader =
        req.headers['authorization'];

    const token =
        authHeader &&
        authHeader.split(' ')[1];

    if (!token) {

        return res.status(401).json({
            success: false,
            message: 'Token fehlt'
        });
    }

    jwt.verify(
        token,
        process.env.JWT_SECRET,
        (err, user) => {

            if (err) {

                return res.status(401).json({
                    success: false,
                    message: 'Token ungültig'
                });
            }

            req.user = user;

            next();
        }
    );
}




//************** Speichere optimierte Kwh in DB  ********************************
/*
app.post(
    '/save-kwh',
    authenticateToken,
    async (req, res) => {

        try {
           
            
            const {
                result_date,
                optimized_kwh
            } = req.body;

            const { error } =
                await supabase
                    .from('pv_results')
                    .upsert({
                        userID:
                            req.user.userID,

                        result_date,

                        optimized_kwh
                    },
                    {
                        onConflict:
                            'userID,result_date'
                    });
            

            if (error) {

                console.error(error);

                return res.status(500).json({
                    success: false
                });
            }

            res.json({
                success: true
            });

        } catch (err) {

            console.error(err);

            res.status(500).json({
                success: false
            });
        }
    }
);
*/
app.post(
    '/save-kwh',
    authenticateToken,
    async (req, res) => {

        try {

            console.log("req.user =", req.user);
            console.log("req.body =", req.body);

            const {
                result_date,
                optimized_kwh
            } = req.body;

            const result =
                await supabase
                    .from('pv_results')
                    .upsert(
                        {
                            userID: req.user.userID,
                            result_date,
                            optimized_kwh
                        },
                        {
                            onConflict: 'userID,result_date'
                        }
                    )
                    .select();

            console.log(result);

            if (result.error) {

                console.error(result.error);

                return res.status(500).json({
                    success: false
                });
            }

            res.json({
                success: true
            });

        } catch (err) {

            console.error(err);

            res.status(500).json({
                success: false
            });
        }
    }
);


//************** dailycontrolPlan vom Server bereitstellen ********************************
app
app.get(
    '/daily-control-plan',
    authenticateToken,
    async (req, res) => {

        try {

            const today =
                new Date()
                    .toISOString()
                    .substring(0, 10);

            const {
                data,
                error
            } = await supabase
                .from(
                    'daily_control_plans'
                )
                .select('*')
                .eq(
                    'user_ref',
                    req.user.uid
                )
                .eq(
                    'plan_date',
                    today
                )
                .single();

            if (error || !data) {

                return res.status(404).json({
                    success: false
                });
            }

            res.json({
                success: true,
                plan: data.plan_json
            });

        } catch (err) {

            console.error(err);

            res.status(500).json({
                success: false
            });
        }
    }
);


//************** Login ********************************
app.post('/login', async (req, res) => {

    const {
        user_id,
        eeg_id,
        reg_key
    } = req.body;

    try {

        const { data: user, error } =
            await supabase
                .from('users')
                .select('*')
                .eq('user_id', user_id)
                .eq('eeg_id', eeg_id)
                .single();

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User: Ungültige Daten'
            });
        }

        const valid =
            await bcrypt.compare(
                reg_key,
                user.reg_key_hash
            );

        if (!valid) {
            return res.status(401).json({
                success: false,
                message: 'Key: Ungültige Daten'
            });
        }

        const token =
            jwt.sign(
                {
                    uid: user.id
                },
                process.env.JWT_SECRET,
                {
                    expiresIn: '3d'  // Token läuft nach 3 Tagen ab
                }
            );

        res.json({
            success: true,
            token
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: users.id
        });
    }
});

app.get('/', (req, res) => {
  res.send('PV Backend läuft');
});

app.listen(3000, () => {
  console.log('Server läuft auf Port 3000');
});
