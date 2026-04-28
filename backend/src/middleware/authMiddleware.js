const jwt = require('jsonwebtoken')
const User = require('../models/User')
const { jwtSecret } = require('../config/auth')
exports.protect = async (req,res,next)=>{ try{ const t=(req.headers.authorization||'').split(' ')[1]; if(!t) return res.status(401).json({message:'Not authorized'}); const d=jwt.verify(t,jwtSecret); req.user=await User.findById(d.id); if(!req.user) return res.status(401).json({message:'Not authorized'}); next(); }catch{res.status(401).json({message:'Not authorized'})}}
exports.allowRoles = (...roles)=>(req,res,next)=> roles.includes(req.user.role)?next():res.status(403).json({message:'Forbidden'})
