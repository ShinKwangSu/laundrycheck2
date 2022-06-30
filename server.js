const express = require('express')
const req = require('express/lib/request')
const app = express()
const bodyParser = require('body-parser')
app.use(bodyParser.urlencoded({extended: true}))
// app.use(express.urlencoded({extended: true}))
const MongoClient = require('mongodb').MongoClient
const methodOverride = require('method-override')
app.use(methodOverride('_method'))
app.set('view engine', 'ejs')
require('dotenv').config()

// public 폴더 사용하려면
app.use('/public', express.static('public'))

var db
MongoClient.connect(process.env.DB_URL, { useUnifiedTopology: true }, function(error, client) {
  // 연결되면 할일
  if (error) return console.log(error)

  db = client.db('laundrycheck2')

  app.listen(process.env.PORT, function() {
    console.log('listening on 8080')
  })
})

// 로그인
const passport = require('passport')
const LocalStrategy = require('passport-local').Strategy
const session = require('express-session')
const { render } = require('express/lib/response')
const connect = require('passport/lib/framework/connect')
const res = require('express/lib/response')

// app.use() -> 미들웨어
// 웹서버는 요청-응답해주는 머신
// 미들웨어 : 요청-응답 중간에 뭔가 실행되는 코드
app.use(session({
  secret : '비밀코드', 
  resave : true, 
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session()); 

app.get('/login', function(req, res) {
  res.render('login.ejs')
})

app.post('/login', passport.authenticate('local', {
  failureRedirect : '/login'
}), function(req, res) {
  console.log('로그인 성공')
  req.session.nickname = req.body.id
  req.session.save(function() {
    res.redirect('/')
  })
})

// app.get('/fail', function(req, res) {
//   res.redirect('/login')
//   console.log('로그인 실패')
// })

// 인증하는 방법을 Strategy라 칭함
// done() 함수의 파라미터는 3개가 올 수 있다.
// done(서버에러, 성공시사용자DB데이터, 에러메시지)
// 서버에러는 보통 ``if (에러) return done(에러)`` 이걸로 처리 가능하기에 null
// 성공시DB사용자데이터는 성공시 결과.  만약 아이디 비번이 틀리다면 false
// 에러메시지는 에러메시지

// 현재 코드는 보안이 쓰레기 비번 암호화 해야함
// 아이디 비밀번호 일치 확인
passport.use(new LocalStrategy({
  usernameField: 'id',
  passwordField: 'pw',
  session: true,
  passReqToCallback: false,
}, function (입력한아이디, 입력한비번, done) {
  db.collection('customer').findOne({ id: 입력한아이디 }, function (에러, 결과) {
    if (에러) return done(에러)

    if (!결과) return done(null, false, { message: '존재하지않는 아이디요' })
    if (입력한비번 == 결과.pw) {
      return done(null, 결과)
    } else {
      return done(null, false, { message: '비번틀렸어요' })
    }
  })
}))

// 세션 데이터 만들기
// id를 이용해서 세션을 저장시킴(로그인 성공시 발동)
passport.serializeUser(function (user, done) {
  done(null, user.id)
});

// 이 세션 데이터를 가진 사람을 DB에서 찾아주세요(마이페이지 접속 시 발동)
// deserializeUser() => 로그인 한 유저의 세션 아이디를 바탕으로 개인정보를 DB에서 찾는 역할
passport.deserializeUser(function (아이디, done) {  // 아이디는 위에 있는 user.id랑 같음
  db.collection('customer').findOne({id : 아이디}, function(에러, 결과) {
    done(null, 결과)
  })
}); 

// 로그아웃
app.get('/logout', function(req, res) {
  req.logout()
  
  // connect.sid 라는 세션을 삭제
  req.session.save(function () {
    res.clearCookie('connect.sid')
    res.redirect('/')
  })
})

// 회원가입
app.get('/signup', function(req, res) {
  res.render('signup.ejs')
})

app.post('/signup', function(req, res) {
  db.collection('customer').insertOne( { name: req.body.name, id: req.body.id, pw: req.body.pw, phone: req.body.phone }, function(error, result) {
    res.redirect('/login')
  })
})

// 로그인 후 세션이 있으면 req.user가 항상 있음
function isLogin(req, res, next) {
  if (req.user) {
    next()
    return true
  } else {
    res.render('loginreq.ejs')
  }
}

// 메인페이지 이동
app.get('/', function(req, res) {
    if (!req.session.nickname) {
      res.render('index.ejs', {session: "true"});
    }
    else {
      res.render('index.ejs', {session: "false"});
    }
  })