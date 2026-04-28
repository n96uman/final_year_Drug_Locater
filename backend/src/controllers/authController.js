const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const User = require('../models/User')
const { jwtSecret } = require('../config/auth')

const img = (req,p)=> p?.startsWith('http')?p:`${req.protocol}://${req.get('host')}${p||''}`
const safe = (u,req)=>({id:u._id,name:u.name,email:u.email,role:u.role,profileImage:img(req,u.profileImage)})

exports.register = async (req,res)=>{
  const {name,email,password,role}=req.body
  if(!name||!email||!password||!role) return res.status(400).json({message:'All fields required'})
  if(await User.findOne({email:email.toLowerCase()})) return res.status(409).json({message:'Email already exists'})
  const user = await User.create({name,email:email.toLowerCase(),password:await bcrypt.hash(password,10),role,profileImage:req.file?`/uploads/${req.file.filename}`:'https://cdn-icons-png.flaticon.com/512/149/149071.png'})
  const token = jwt.sign({id:user._id,role:user.role},jwtSecret,{expiresIn:'7d'})
  res.status(201).json({token,user:safe(user,req)})
}

exports.login = async (req,res)=>{
  const {email,password}=req.body
  const user = await User.findOne({email:email.toLowerCase()})
  if(!user || !(await bcrypt.compare(password,user.password))) return res.status(401).json({message:'Invalid credentials'})
  const token = jwt.sign({id:user._id,role:user.role},jwtSecret,{expiresIn:'7d'})
  res.json({token,user:safe(user,req)})
}

exports.me = async (req,res)=>res.json({user:safe(req.user,req)})
exports.updateProfile = async (req,res)=>{ if(req.body.name!=null) req.user.name=req.body.name; if(req.file) req.user.profileImage=`/uploads/${req.file.filename}`; await req.user.save(); res.json({user:safe(req.user,req)}) }
