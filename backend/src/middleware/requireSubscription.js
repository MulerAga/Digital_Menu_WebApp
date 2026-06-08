const { pool } = require('../config/db');

module.exports = async (req,res,next)=>{
 try{
   const [rows] = await pool.query(
    `SELECT id FROM subscriptions
     WHERE user_id=?
     AND status='active'
     AND end_date > NOW()
     LIMIT 1`,
    [req.user.id]
   );

   if(!rows.length){
     return res.status(403).json({
       message:'Subscription required'
     });
   }

   next();

 }catch(err){
   res.status(500).json({message:err.message});
 }
};