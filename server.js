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
const flash = require('connect-flash')
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
app.use(flash());
app.use(passport.initialize());
app.use(passport.session()); 

app.get('/login', function(req, res) {

  let flashmsg = req.flash()
  let feedback = flashmsg.error

  console.log(flashmsg.error)

  if (feedback === undefined) {
    feedback = 0
    res.render('login.ejs', {returnRes : 'HI'})
  }
  else if (feedback !== undefined) {
    res.render('login.ejs', {returnRes : feedback})
  }
})

app.post('/login', passport.authenticate('local', {
  failureRedirect : '/login',
  failureFlash : true,
  successFlash : true
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
// 성공시사용자DB데이터는 성공시 결과.  만약 아이디 비번이 틀리다면 false
// 에러메시지는 에러메시지

// 현재 코드는 보안이 쓰레기 비번 암호화 해야함
// 아이디 비밀번호 일치 확인
passport.use(new LocalStrategy({
  usernameField: 'id',
  passwordField: 'pw',
  session: true,
  passReqToCallback: false,
}, function (입력한아이디, 입력한비번, done) {
  db.collection('member').findOne({ id: 입력한아이디 }, function (에러, 결과) {
    if (에러) return done(에러)

    if (!결과) {
      console.log('존재하지 않는 아이디 입니다.')
      return done(null, false, { message: 'ID' })
    }

    if (입력한비번 == 결과.pw) {
      return done(null, 결과, { message: 'WELCOME' })
    }
    else {
      console.log('비밀번호가 틀렸습니다.')
      return done(null, false, { message: 'PW' })
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
  db.collection('member').findOne({id : 아이디}, function(에러, 결과) {
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
  db.collection('member').insertOne( { name: req.body.name, id: req.body.id, pw: req.body.pw, phone: req.body.phone, account: 0 }, function(error, result) {
    res.redirect('/login')
  })
})

// 아이디 중복 확인
app.get('/idcheck', function(req, res) {
  res.render('idcheck.ejs')
})

app.post('/idcheck', function(req, res) {
  console.log(req.body)

  let findRes = 1
  db.collection('member').findOne( {id: req.body.id}, function(error, result) {
    console.log('검색 완료')
    if (result != undefined) {
      findRes = 0
    } else {
      findRes = 1
    }

    const response = {
      findRes
    }
    console.log(response)

    res.send({checkRes : findRes})
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
  let flashmsg = req.flash()
  let feedback = flashmsg.success

  if (feedback != 0) {
    if (!req.session.nickname) {
      res.render('index.ejs', {session: "true", successRes: 'NOWELCOME'});
    }
    else {
      res.render('index.ejs', {session: "false", successRes: feedback})
    }
  }
})

// 기기 현황 페이지 이동
app.get('/macStatus', function(req, res) {
  if (!req.session.nickname) {
    res.render('macstatus.ejs', {session: "true"});
  }
  else {
    res.render('macstatus.ejs', {session: "false"});
  }
})

// 유의사항 페이지 이동
app.get('/caution', function(req, res) {
  if (!req.session.nickname) {
    res.render('caution.ejs', {session: "true"});
  }
  else {
    res.render('caution.ejs', {session: "false"});
  }
})

// 웨이팅 등록 페이지 이동
app.get('/wait', isLogin, function(req, res) {
  console.log(req.user);

    //DB에서 데이터 꺼내기 - DB.counter 내의 대기인원수를 찾음
    db.collection('counter').findOne({name : '대기인원수'}, function(에러, 결과){
      console.log("/wait 대기인원수 : " + 결과.totalWait) //결과.totalWait = 대기인원수
    
      //찾은 데이터를 wait.ejs 안에 넣기
      //req.user를 사용자라는 이름으로, 결과를 counters라는 이름으로 보내기
      res.render('wait.ejs', {사용자 : req.user, counters : 결과})
    })
})


app.post('/wait', isLogin, function(req, res){
  //db에서 데이터 꺼내기 - db.counter에서 name이 대기인원수인 데이터 찾기
  db.collection('counter').findOne({name: '대기인원수'}, function(에러, 결과1){
    var waitinfo개수 = 결과1.totalWait + 결과1.totalUse

    //db.waitinfo에 로그인한 유저의 id를 찾아서.. --------> find()로 변경해야할듯 
    db.collection('waitinfo').find({userid : req.user.id}).toArray(function(에러, 결과2) {
      if(에러) return done(에러)

      // ------------------- 웨이팅 등록 최초 1회 ---------------
      if(결과2.length == 0) {

        //db 저장 - 웨이팅 신청 가능으로 db에.waitinfo에 저장 (_id : waitinfo개수+1로 새로운 데이터를 저장)
        db.collection('waitinfo').insertOne( {_id : waitinfo개수 + 1, myNumber : waitinfo개수 + 1, userid : req.user.id, wmac : 0, isUseWait : false} , function(에러, 결과){
          console.log("결과 : " + 결과)
          console.log("에러 : " + 에러)

          if (결과 != undefined) {
            console.log('대기인원 데이터 저장완료');
            //db 수정 - db.counter 내의 totalWait이라는 항목도 +1 증가(총대기인원수+1)
            //operator 종류 : $set(변경), $inc(증가), $min(기존값보다 적을 때만 변경), $rename(key값 이름변경)
            db.collection('counter').updateOne({name: '대기인원수'}, {$inc: {totalWait:1} }, function(에러, 결과){
              if(에러){return console.log(에러)}
              res.redirect('/waitsuccess')
              console.log('웨이팅 신청 성공')
            })
          }
          else {
            res.redirect('/wait')
          }
        })
      }
      // ------------------- 웨이팅 등록 재사용 ---------------
      else {
        var 찾았니
        for (let i = 0; i < 결과2.length; i++) {
          if (결과2[i].isUseWait == true) {
            찾았니 = "못찾음"
          }
          else {
            찾았니 = "찾음"
          }
        }

        //로그인한 유저가 waitinfo에 없거나 이전에 사용한 사람이라면.. 웨이팅 신청 가능으로 db에.waitinfo에 저장
        if (찾았니 == "못찾음") {

          //db 저장 - 웨이팅 신청 가능으로 db에.waitinfo에 저장 (_id : 총대기인원수+1로 새로운 데이터를 저장)
          db.collection('waitinfo').insertOne( {_id : waitinfo개수 + 1, myNumber : waitinfo개수 + 1, userid : req.user.id, wmac : 0, isUseWait : false} , function(에러, 결과){
            console.log('대기인원 데이터 저장완료');
            console.log("결과 : " + 결과)
            console.log("에러 : " + 에러)

            if (결과 != undefined) {
              //db 수정 - db.counter 내의 totalWait이라는 항목도 +1 증가(총대기인원수+1)
              //operator 종류 : $set(변경), $inc(증가), $min(기존값보다 적을 때만 변경), $rename(key값 이름변경)
              db.collection('counter').updateOne({name: '대기인원수'}, {$inc: {totalWait:1} }, function(에러, 결과){
                if(에러){return console.log(에러)}
                res.redirect('/waitsuccess')
                console.log('웨이팅 신청성공')
              })
            }
            else {
              res.redirect('/wait')
            }
          })
        }
        else if (찾았니 == "찾음") {
          res.redirect('/waitalready')
          console.log('웨이팅 신청 되어있음')
        }
      }
    })
  })
})

// 웨이팅 신청이 되어있으면 뿌려주는 페이지
app.get('/waitalready', isLogin, function(req, res) {
  console.log(req.user)
  res.render('waitalready.ejs')
})

// 웨이팅 신청 성공하면 뿌려주는 페이지
app.get('/waitsuccess', isLogin, function(req, res) {
  console.log(req.user)
  res.render('waitsuccess.ejs')
})

// 웨이팅 확인 페이지 이동
app.get('/waitcheck', isLogin, function(req, res) {
  console.log(req.user)

  // ------------------- 웨이팅 등록 최초 1회 -------------------
  //db.waitinfo에 로그인한 유저의 id를 찾아서..
  db.collection('waitinfo').findOne({userid : req.user.id}, function(에러, 결과2) {
    if(에러) return done(에러)

    //로그인한 유저가 waitinfo에 없다면.. -> 웨이팅 신청 한 번도 안함
    if(결과2 == null) {
      res.redirect('/awaituse')
      console.log('최초 1회 - 웨이팅 사용 후 확인(미신청 후 waitcheck)');
      return
    }
    else{
      console.log('최초 1회 - 웨이팅 사용 전 확인')
    }
  })

  // ------------------- 웨이팅 등록 재사용 -------------------
  //db.waitinfo에 로그인한 유저의 id를 array로 찾아서.. 
  db.collection('waitinfo').find({userid : req.user.id}).toArray(function(에러, 결과2) {
    if(에러) return done(에러)

    var 유저의웨이팅신청수 = 결과2.length
    console.log("유저의웨이팅신청수(arr.length) : " + 유저의웨이팅신청수);

    var 찾았니
    for (let i = 0; i < 결과2.length; i++) {
      if (결과2[i].isUseWait == true) {
        찾았니 = "못찾음"         //유저의 재신청을 못찾음(true) -> 웨이팅 신청 후(웨이팅 신청해라)
      }
      else {
        찾았니 = "찾음"          //유저의 재신청을 찾음(false) -> 웨이팅 신청 전(웨이팅 정보 확인)
      }
    }

    //로그인한 유저가 이전에 사용했고 재신청하지 않은 경우.. 웨이팅 신청 하도록 /bwaitcheck로..
    if (찾았니 == "못찾음") {
      res.redirect('/awaituse')
      console.log('재사용 - 웨이팅 사용 후 확인')
    }
    else if(찾았니 == "찾음"){
      res.redirect('/bwaituse')
      console.log('재사용 - 웨이팅 사용 전 확인')
    }
  })
})

// 웨이팅 등록하고 기기 작동시키기 전
// 본인 대기번호와 앞에 몊명 남았는지 확인 가능
app.get('/bwaituse', isLogin, function(req, res) {
  console.log(req.user)
  
  //db.waitinfo에 로그인한 유저의 id를 array로 찾아서.. 
  db.collection('waitinfo').find({userid : req.user.id}).toArray(function(에러, 결과2) {
    if(에러) return done(에러)

    console.log("유저의웨이팅신청수(arr.length) : " + 결과2.length);

    var 찾았니
    for (let i = 0; i < 결과2.length; i++) {
      if (결과2[i].isUseWait == true) {
        찾았니 = "못찾음"         //유저의 재신청을 못찾음(true) -> 웨이팅 신청 후(웨이팅 신청해라)
      }
      else {
        찾았니 = "찾음"          //유저의 재신청을 찾음(false) -> 웨이팅 신청 전(웨이팅 정보 확인)
      }
    }

    if (찾았니 == "찾음") {
      var myNumber = 결과2[결과2.length - 1].myNumber
      console.log("/bwaituse 본인웨이팅번호 : " + myNumber)

      //db.counter에서 name이 대기인원수인 데이터 찾기
      db.collection('counter').findOne({name: '대기인원수'}, function(에러, 결과3){
        var totalWait = 결과3.totalWait
        var totalUse = 결과3.totalUse
        var left = myNumber - totalUse - 1

        console.log("/bwaituse 대기인원수 : " + totalWait)
        console.log("/bwaituse 대기사용수 : " + totalUse)
        console.log("/bwaituse 앞에남은인원수 : " + left)

      //찾은 데이터를 bwaituse.ejs 안에 넣기
        //req.user를 사용자라는 이름으로 보내기
        res.render('bwaituse.ejs', {사용자 : req.user, 본인웨이팅번호 : myNumber, 대기사용수 : totalUse})
      })
    }
    else if(찾았니 == "못찾음"){
      console.log('NONE')
    }
  })
})

// 웨이팅 등록하고 기기 작동시킨 후
app.get('/awaituse', isLogin, function(req, res) {
  console.log(req.user)
  res.render('awaituse.ejs')
})

// 마이페이지
app.get('/mypage', isLogin, function(req, res) {
  console.log(req.user)

  if (!req.session.nickname) {
    res.render('mypage.ejs', {session: "true"});
  }
  else {
    res.render('mypage.ejs', {session: "false", 사용자 : req.user});
  }

 // res.render('mypage.ejs', {사용자 : req.user})
})

app.post('/mypage', isLogin, function(req, res) {
  //유저의 웨이팅 신청수에 따라..
  // ------------------- 웨이팅 등록 최초 1회 -------------------
  db.collection('waitinfo').findOne({userid : req.user.id}, function(에러, 결과2) {
    if(에러) return done(에러)

    //로그인한 유저가 waitinfo에 없다면.. -> 웨이팅 신청 한 번도 안함
    if(결과2 == null) {
      res.redirect('/awaituse')
      console.log('최초 1회 - 웨이팅 사용 후 확인(미신청 후 waitcheck)');
      return
    }
    else{
      console.log('null값이 아니면 등록 재사용으로..')
    }
  })

  // ------------------- 웨이팅 등록 재사용 -------------------
  //db.waitinfo에 로그인한 유저의 id를 array로 찾아서.. 
  db.collection('waitinfo').find({userid : req.user.id}).toArray(function(에러, 결과2) {
    if(에러) return done(에러)

    console.log("유저의웨이팅신청수(arr.length) : " + 결과2.length);

    var 찾았니
    var 찾은고유번호
    for (let i = 0; i < 결과2.length; i++) {
      if (결과2[i].isUseWait == true) {
        찾았니 = "못찾음"         //유저의 재신청을 못찾음(true) -> 웨이팅 신청 후(웨이팅 신청해라)
      }
      else {
        찾은고유번호 = 결과2[i].myNumber
        찾았니 = "찾음"          //유저의 재신청을 찾음(false) -> 웨이팅 신청 전(웨이팅 정보 확인)
      }
    }

    //로그인한 유저가 이전에 사용했고 재신청하지 않은 경우.. 웨이팅 신청 하도록 /bwaitcheck로..
    if (찾았니 == "못찾음") {
      res.redirect('/awaituse')
      console.log('재사용 - 웨이팅 사용 후 확인')
    }
    else if(찾았니 == "찾음"){
      db.collection('waitinfo').updateOne({myNumber : 찾은고유번호}, { $set: {isUseWait:true} }, function(에러3, 결과){
        if(에러3){return console.log(에러3)}

        db.collection('waitinfo').find({userid : req.user.id}).toArray(function(에러, 결과3) {
          var 웨이팅사용여부 = 결과3[결과3.length - 1].isUseWait
          console.log(결과3[결과3.length - 1].myNumber)
          console.log("웨이팅사용여부 - true로 바뀌었는가 : " + 웨이팅사용여부);

          //사용한 회원 관리
          if(웨이팅사용여부){ //웨이팅을 사용했다면..
            //db.counter 내의 totalWait -1 감소(대기인원수-1)
            db.collection('counter').updateOne({name: '대기인원수'}, { $inc: {totalWait:-1} }, function(에러1, 결과) {
              if(에러1){return console.log(에러1)}
    
              //db.counter 내의 totalUse +1 증가(대기사용수+1)
              db.collection('counter').updateOne({name: '대기인원수'}, { $inc: {totalUse:1} }, function(에러2, 결과) {
                if(에러2){return console.log(에러2)}
    
                console.log('사용했기 때문에 true로 바뀌고 사용회원관리')
                res.redirect('/')
              })
            })
          }
          else {
            res.redirect('/mypage')
          }
        })
      })
    }
  })
})

app.get('/charge', function(req, res) {
  res.render('charge.ejs')
})

// 지도 (카카오맵)
app.get('/map', function(req, res) {
  db.collection('branch').find().toArray(function(에러, 결과) {
    if (에러) return console.log(에러)

    var store = new Array()
    let name, lat, lng

    for (let i = 0; i < 결과.length; i++) {

      name = 결과[i].name
      lat = 결과[i].lat
      lng = 결과[i].lng

      store[i] = {name, lat, lng}
      
    }
    res.render('map.ejs', {store})
  })
})