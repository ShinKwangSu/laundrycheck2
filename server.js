//server 생성
const express = require('express')
const req = require('express/lib/request')
const app = express()

//bodyParser
const bodyParser = require('body-parser')
app.use(bodyParser.urlencoded({extended: true}))
// app.use(express.urlencoded({extended: true}))

//socket.io
const http = require('http').createServer(app);
const { Server } = require("socket.io");
const io = new Server(http);

//MongoDB
const MongoClient = require('mongodb').MongoClient
const methodOverride = require('method-override')
app.use(methodOverride('_method'))

//ejs 사용 - npm install ejs
app.set('view engine', 'ejs')

//dotenv로 환경변수 관리
require('dotenv').config()

// public 폴더 사용
app.use('/public', express.static('public'))


//MongoDB 연결
var db
MongoClient.connect(process.env.DB_URL, { useUnifiedTopology: true }, function(error, client) {
  // 연결되면 할일
  if (error) return console.log(error)

  db = client.db('laundrycheck2')

  //app.listen(process.env.PORT, function() {   //express(http를 쉽게 사용하기 위한 도구)로 서버 띄움
  http.listen(process.env.PORT, function() {  //http(nodejs 기본 라이브러리) + socket.io로 서버 띄움
    console.log('listening on 9999')
  })
})


//1. 로그인
const passport = require('passport')
const LocalStrategy = require('passport-local').Strategy
const flash = require('connect-flash')
const session = require('express-session')
const { render } = require('express/lib/response')
const connect = require('passport/lib/framework/connect')
const res = require('express/lib/response')
const { is } = require('express/lib/request')

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

/* app.get('/fail', function(req, res) {
  res.redirect('/login')
  console.log('로그인 실패')
}) */

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


//2. 로그아웃
app.get('/logout', function(req, res) {
  req.logout()
  
  // connect.sid 라는 세션을 삭제
  req.session.save(function () {
    res.clearCookie('connect.sid')
    res.redirect('/')
  })
})


//3. 회원가입
app.get('/signup', function(req, res) {
  res.render('signup.ejs')
})

app.post('/signup', function(req, res) {
  db.collection('member').insertOne( { name: req.body.name, id: req.body.id, pw: req.body.pw, phone: req.body.phone, account: 0 }, function(error, result) {
    res.redirect('/login')
  })
})

// 아이디 중복 확인
app.post('/idcheck', function(req, res) {
  console.log(req.body)

  let findRes = 1
  db.collection('member').findOne( {id: req.body.id}, function(error, result) {
    console.log('/idcheck.post >> db.member에서 id가 로그인한 유저의 id인 데이터의 검색 성공')
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


//4. 메인페이지(express)
/* app.get('/', function(req, res) {
  let flashmsg = req.flash()
  let feedback = flashmsg.success

  if (feedback != 0) {
    if (!req.session.nickname) {
      res.render('index.ejs', {session: "true", successRes: 'NOWELCOME', welcomeUser: 'NOWELCOME'});
    }
    else {
      res.render('index.ejs', {session: "false", successRes: feedback, welcomeUser: req.user})
    }
  }
}) */

//4. 메인페이지(socket)
app.get('/', function (req, res) {
  let flashmsg = req.flash()
  let feedback = flashmsg.success

  if (feedback != 0) {
    if (!req.session.nickname) {
      res.render('socket.ejs', { session: "true", successRes: 'NOWELCOME', welcomeUser: 'NOWELCOME' });
    }
    else {
      res.render('socket.ejs', { session: "false", successRes: feedback, welcomeUser: req.user })
    }
  }
});


// 카운트다운 타이머>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
//let Timer1, Timer2;
let time1, time2;
let min1, min2;
let sec1, sec2;
let btnClick1 = 0;    let btnClick2 = 0;    //branchinfo 버튼 클릭 여부

function StartTimerA1() {
  time1 = 120000;                   //setInterval(1000) = 1초인데, *3분(180초)하면 180,000
  min1 = 1;
  sec1 = 60;
  function TIMER1() {
    PLAYTIME1 = setInterval(function () {
      btnClick1 = 1;               //branchinfo 버튼 클릭 여부(true)
      time1 = time1 - 1000;         //1초씩 감소
      min1 = time1 / (60 * 1000);   //초를 분으로 나눔
  
      if (sec1 > 0) {   //sec=60 에서 1씩 빼서 출력
        //sec1 = sec1 - 1;
        //Timer1.value = Math.floor(min1) + ':' + sec1;   //실수로 계산 > 소숫점 아래를 버리고 출력
        // --------------------------------------
        min1 = Math.floor(min1);
        sec1 = sec1 - 1;
        
        console.log("StartTimerA1() >> 타이머1(??:??) " + min1 + ":" + sec1);
        // --------------------------------------
        // Timer1 = min1 + " : " + sec1;
        // console.log("StartTimerA1() >> 타이머1(?:?) " + Timer1);
      }
      if (sec1 == 0) {
        //sec(60) 기준으로 0에서 -1하면 -59 출력
        //따라서 0이면 sec을 60으로 변경하고, value는 0으로 출력
        // sec1 = 60;
        // Timer1.value = Math.floor(min1) + ':' + '00'
        // --------------------------------------
        min1 = Math.floor(min1);
        sec1 = 60;

        console.log("StartTimerA1() >> 타이머1(??:??) " + min1 + ":" + sec1);
        // --------------------------------------
        // Timer1 = min1 + " : " + "00";
        // console.log("StartTimerA1() >> 타이머1(?:00) " + Timer1);
      }
    }, 1000)  //1초마다
  }
  
  TIMER1();

  setTimeout(function () {
    clearInterval(PLAYTIME1);
    btnClick1 = 0;                    //branchinfo 버튼 클릭 여부(false)

    console.log("StartTimerA1() >> 타이머1 삭제");
    console.log("StartTimerA1() >> btnClick1 is 0?: " + btnClick1);

    //서버의 타이머1이 삭제될 때 db.branchUsage에서 branchName이 A인 isUseWmac1을 false로 변경 => 사용중아님
    db.collection('branchUsage').updateOne({branchName : 'A'}, {$set : {isUseWmac1:false} }, function(에러, 결과){
      if(에러){return console.log(에러)}
      console.log('StartTimerA1() >> db.branchUsage - A지점의 Wmac1이 false로 수정(즉, A지점 1번 세탁기 사용끝)')
    })

  }, 120000);                      //3분(180,000)되면 타이머 삭제
}

function StartTimerA2() {
  time2 = 120000;                   //setInterval(1000) = 1초인데, *3분(180초)하면 180,000
  min2 = 1;
  sec2 = 60;
  function TIMER2() {
    PLAYTIME2 = setInterval(function () {
      btnClick2 = 1;               //branchinfo 버튼 클릭 여부(true)
      time2 = time2 - 1000;         //1초씩 감소
      min2 = time2 / (60 * 1000);   //초를 분으로 나눔
  
      if (sec2 > 0) {   //sec=60 에서 1씩 빼서 출력
        //sec2 = sec2 - 1;
        //Timer2.value = Math.floor(min2) + ':' + sec2;   //실수로 계산 > 소숫점 아래를 버리고 출력
        // --------------------------------------
        min2 = Math.floor(min2);
        sec2 = sec2 - 1;
        
        console.log("StartTimerA2() >> 타이머2(??:??) " + min2 + ":" + sec2);
        // --------------------------------------
        // Timer2 = min2 + " : " + sec2;
        // console.log("StartTimerA2() >> 타이머2(?:?) " + Timer2);
      }
      if (sec2 == 0) {
        //sec(60) 기준으로 0에서 -1하면 -59 출력
        //따라서 0이면 sec을 60으로 변경하고, value는 0으로 출력
        // sec2 = 60;
        // Timer2.value = Math.floor(min2) + ':' + '00'
        // --------------------------------------
        min2 = Math.floor(min2);
        sec2 = 60;

        console.log("StartTimerA2() >> 타이머2(??:??) " + min2 + ":" + sec2);
        // --------------------------------------
        // Timer2 = min2 + " : " + "00";
        // console.log("StartTimerA2() >> 타이머2(?:00) " + Timer2);
      }
    }, 1000)  //1초마다
  }
  
  TIMER2();

  setTimeout(function () {
    clearInterval(PLAYTIME2);
    btnClick2 = 0;                    //branchinfo 버튼 클릭 여부(false)

    console.log("StartTimerA2() >> 타이머2 삭제");
    console.log("StartTimerA1() >> btnClick2 is 0?: " + btnClick2);

    //서버의 타이머2가 삭제될 때 db.branchUsage에서 branchName이 A인 isUseWmac2를 false로 변경 => 사용중아님
    db.collection('branchUsage').updateOne({branchName : 'A'}, {$set : {isUseWmac2:false} }, function(에러, 결과){
      if(에러){return console.log(에러)}
      console.log('StartTimerA2() >> db.branchUsage - A지점의 Wmac2이 false로 수정(즉, A지점 2번 세탁기 사용끝)')
    })

  }, 120000);                      //3분(180,000)되면 타이머 삭제
}
// >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>


//5. 기기 현황 페이지 이동 - 원본
app.get('/macstatus', function (req, res) {

  if(btnClick == 1){ console.log("/macstatus.get >> btnClick is 1 : " + btnClick ); }
  else             { console.log("/macstatus.get >> btnClick is not 1 : " + btnClick); }

  if (!req.session.nickname) {    //로그인X
    res.render('macstatus.ejs', { session: "true", 시간 : time, 분 : min, 초 : sec, 클릭여부 : btnClick});
  }
  else {                          //로그인O
    res.render('macstatus.ejs', { session: "false", 시간 : time, 분 : min, 초 : sec, 클릭여부 : btnClick});
  }
})

app.post('/macstatus', function(req, res) {
  if (!req.session.nickname) {    //로그인X
    res.redirect('/awaituse'); 
    console.log("/macstatus.post >> 로그인X - 웨이팅 신청 불가")
  }
  else {                          //로그인O
    // ------------------- 웨이팅 등록 최초 1회 -------------------
    //db.waitinfo에서 userid가 로그인한 유저의 id인 데이터를 조회
    db.collection('waitinfo').findOne({userid : req.user.id}, function(에러, 결과2) {
      if(에러) return done(에러)

      if(결과2 == null) { //신청 이력이 없음
        res.redirect('/awaituse')
        console.log('/macstatus.post >> 최초 1회 - 현재 웨이팅 신청 가능')
        return
      }
    })

    // ------------------- 웨이팅 등록 1회 이상(재사용) ------------
    //db.waitinfo에서 userid가 로그인한 유저의 id인 데이터를 조회
    db.collection('waitinfo').find({userid : req.user.id}).toArray(function(에러, 결과2) {
      if(에러) return done(에러)

      var 유저의웨이팅신청수 = 결과2.length
      console.log("/macstatus.post >> 1회 이상 - " + req.user.id + "의 웨이팅신청수(arr.length) : " + 유저의웨이팅신청수);

      var 찾았니
      for (let i = 0; i < 결과2.length; i++) {
        if (결과2[i].isUseWait == true) {
        찾았니 = "못찾음"         //로그인한 유저가 waitinfo에 없거나 이전에 사용 => 웨이팅 신청 가능
        }
        else {
          찾았니 = "찾음"         //로그인한 유저가 waitinfo에 있음 => 웨이팅 신청 불가
        }
      }

      if (찾았니 == "못찾음") {
        res.redirect('awaituse');
        console.log('/macstatus.post >> 1회 이상 - 현재 웨이팅 신청 가능')
      }
      else if(찾았니 == "찾음"){
        //자신의 차례이면 branchinfo, 자신의 차례가 아니면 bwaituse
        //res.redirect('/bwaituse');
        res.redirect('/branchinfo');
        console.log('/macstatus.post >> 1회 이상 - 현재 웨이팅 신청 불가')
      }
    })
  } 
})

//기기 현황 페이지 - A지점
app.get('/macstatusA', function (req, res) {

  if(btnClick1 == 1){ console.log("/macstatusA.get >> btnClick1 is 1 : " + btnClick1 ); }
  else              { console.log("/macstatusA.get >> btnClick1 is not 1 : " + btnClick1); }

  if(btnClick2 == 1){ console.log("/macstatusA.get >> btnClick2 is 1 : " + btnClick2 ); }
  else              { console.log("/macstatusA.get >> btnClick2 is not 1 : " + btnClick2); }

  if (!req.session.nickname) {    //로그인X
    res.render('macstatusA.ejs', { session: "true", //});
    시간1 : time1, 분1 : min1, 초1 : sec1, 클릭여부1 : btnClick1,
    시간2 : time2, 분2 : min2, 초2 : sec2, 클릭여부2 : btnClick2});
  }
  else {                          //로그인O
    res.render('macstatusA.ejs', { session: "false", //});
    시간1 : time1, 분1 : min1, 초1 : sec1, 클릭여부1 : btnClick1,
    시간2 : time2, 분2 : min2, 초2 : sec2, 클릭여부2 : btnClick2});
  }
})

app.post('/macstatusA', function(req, res) {
  if (!req.session.nickname) {    //로그인X
    res.redirect('/awaituse');
    console.log("/macstatusA.post >> 로그인X - 웨이팅 신청 불가")
  }
  else {                          //로그인O
    // ------------------- 웨이팅 등록 최초 1회 -------------------
    //db.waitinfo에서 userid가 로그인한 유저의 id인 데이터를 조회
    db.collection('waitinfo').findOne({userid : req.user.id}, function(에러, 결과2) {
      if(에러) return done(에러)

      if(결과2 == null) { //신청 이력이 없음
        res.redirect('/awaituse')
        console.log('/macstatusA.post >> 최초 1회 - 현재 웨이팅 신청 가능')
        return
      }
    })

    // ------------------- 웨이팅 등록 재사용 -------------------
    //db.waitinfo에서 userid가 로그인한 유저의 id인 데이터를 조회
    db.collection('waitinfo').find({userid : req.user.id}).toArray(function(에러, 결과2) {
      if(에러) return done(에러)

      var 유저의웨이팅신청수 = 결과2.length
      console.log("/macstatusA.post >> 1회 이상 - " + req.user.id + "의 웨이팅신청수(arr.length) : " + 유저의웨이팅신청수);

      var 찾았니
      for (let i = 0; i < 결과2.length; i++) {
        if (결과2[i].isUseWait == true) {
        찾았니 = "못찾음"         //로그인한 유저가 waitinfo에 없거나 이전에 사용 => 웨이팅 신청 가능
        }
        else {
          찾았니 = "찾음"         //로그인한 유저가 waitinfo에 있음 => 웨이팅 신청 불가
        }
      }

      if (찾았니 == "못찾음") {
        res.redirect('awaituse');
        console.log('/macstatusA.post >> 1회 이상 - 현재 웨이팅 신청 가능')
      }
      else if(찾았니 == "찾음"){
        //자신의 차례이면 branchinfo, 자신의 차례가 아니면 bwaituse
        console.log('/macstatusA.post >> 1회 이상 - 현재 웨이팅 신청 불가(되어있음)')

        //macstatusA.ejs의 ajax로 받은 macNumber(클릭된 버튼 번호)에 따라 다른 branchinfo로 redirect하는 부분
        // console.log("/macstatusA.post >> macstatusA에서 클릭된 macNumber : " + req.body.macNumber)
  
        // if(req.body.macNumber == "A1"){
        //   res.redirect('/branchinfoA1');
        //   console.log("/macstatusA.post >> req.body.macNumber is A1 AND redirect to /branchinfoA1")
        // }
        // if(req.body.macNumber == "A2"){
        //   res.redirect('/branchinfoA2');
        //   console.log("/macstatusA.post >> req.body.macNumber is A2 AND redirect to /branchinfoA2")
        // }
      }
    })
  } 
})

//branchfinfoA1으로 redirect
app.post('/macstatusA1', function(req, res) {
  if (!req.session.nickname) {    //로그인X
    res.redirect('/awaituse');
    console.log("/macstatusA1.post >> 로그인X - 웨이팅 신청 불가")
  }
  else {                          //로그인O

    //모든 기기가 사용중이지 않을 때는 그냥 기기 사용 가능하도록.... -> 추가
    db.collection('branchUsage').findOne({branchName: 'A'}, function(에러, 결과){
      console.log('/macstatusA1.post >> 결과 : ' + 결과) 
      console.log('/macstatusA1.post >> 결과.isUseWmac1 is false : ' + 결과.isUseWmac1)
      console.log('/macstatusA1.post >> 결과.isUseWmac2 is false : ' + 결과.isUseWmac2)

      //모든 기기가 사용중이지 않을 때는 그냥 기기 사용 가능하도록.... -> 추가
      if(결과.isUseWmac1 == false && 결과.isUseWmac2 == false) { 
        res.redirect('/branchinfoA1');
        console.log('/macstatusA1.post >> 모든 기기가 사용중이지 않아 그냥 기기 사용 가능(모든 기기 false)')
      }
      //둘 중 하나의 기기가 사용중이지 않을 때는 그냥 기기 사용 가능하도록.... -> 추가
      else if(결과.isUseWmac1 == false && 결과.isUseWmac2 == true) { 
        res.redirect('/branchinfoA1');
        console.log('/macstatusA1.post >> 모든 기기가 사용중이지 않아 그냥 기기 사용 가능(모든 기기 false)')
      }
      else if(결과.isUseWmac1 == true && 결과.isUseWmac2 == false) { 
        res.redirect('/branchinfoA1');
        console.log('/macstatusA1.post >> 모든 기기가 사용중이지 않아 그냥 기기 사용 가능(모든 기기 false)')
      }
      //모든 기기가 사용중일 때는 웨이팅 신청 가능하도록....
      else{
        // ------------------- 웨이팅 등록 최초 1회 -------------------
        //db.waitinfo에서 userid가 로그인한 유저의 id인 데이터를 조회
        db.collection('waitinfo').findOne({userid : req.user.id}, function(에러, 결과2) {
          if(에러) return done(에러)
    
          if(결과2 == null) { //신청 이력이 없음
            res.redirect('/awaituse')
            console.log('/macstatusA1.post >> 최초 1회 - 현재 웨이팅 신청 가능')
            return
          }
        })

        // ------------------- 웨이팅 등록 재사용 -------------------
        //db.waitinfo에서 userid가 로그인한 유저의 id인 데이터를 조회
        db.collection('waitinfo').find({userid : req.user.id}).toArray(function(에러, 결과2) {
          if(에러) return done(에러)
    
          var 유저의웨이팅신청수 = 결과2.length
          console.log("/macstatusA1.post >> 1회 이상 - " + req.user.id + "의 웨이팅신청수(arr.length) : " + 유저의웨이팅신청수);
    
          var 찾았니
          var 찾은고유번호
          var 찾은기기번호
          for (let i = 0; i < 결과2.length; i++) {
            if (결과2[i].isUseWait == true) {
            찾았니 = "못찾음"         //로그인한 유저가 waitinfo에 없거나 이전에 사용 => 웨이팅 신청 가능
            }
            else {
              찾은고유번호 = 결과2[i].myNumber
              찾은기기번호 = 결과2[i].wmac
              찾았니 = "찾음"         //로그인한 유저가 waitinfo에 있음 => 웨이팅 신청 불가
            }
          }
    
          if (찾았니 == "못찾음") {
            res.redirect('awaituse');
            console.log('/macstatusA1.post >> 1회 이상 - 현재 웨이팅 신청 가능')
          }
          else if(찾았니 == "찾음"){
            // res.redirect('/branchinfoA1');
            // console.log('/macstatusA1.post >> 1회 이상 - 현재 웨이팅 신청 불가(되어있음)')
    
    
            //신청 시 부여된 myNumber 순서대로 웨이팅 사용하기 위해 <<페이지 이동>>
            //웨이팅 순서대로 하는 코드
            //db.counter에서 name이 대기인원수인 데이터를 조회
            db.collection('counter').findOne({name: '대기인원수'}, function(에러, 결과1){
              var 현재순서고유번호 = 결과1.totalUse + 1;
    
              //웨이팅 사용하기 위해 페이지 이동하는 코드
              if(현재순서고유번호 == 찾은고유번호) {  //자신의 차례라서 branchinfo로 이동 => 웨이팅 사용 가능
                console.log("/macstatusA1.post >> 현재순서고유번호 : " + 현재순서고유번호 + ", 찾은고유번호 : " + 찾은고유번호)
    
                res.redirect('/branchinfoA1');
                console.log('/macstatusA1.post >> 1회 이상 - 현재 웨이팅 신청 불가(되어있음)')
              }
              else {                                //자신의 차례 아니라서 bwaituse로 이동 => 웨이팅 사용 불가
                res.redirect('/bwaituse');
              }
    
            })
    
          }
        })

      }
    })

    // //모든 기기가 사용중일 때는 웨이팅 신청 가능하도록....
    // // ------------------- 웨이팅 등록 최초 1회 -------------------
    // //db.waitinfo에서 userid가 로그인한 유저의 id인 데이터를 조회
    // db.collection('waitinfo').findOne({userid : req.user.id}, function(에러, 결과2) {
    //   if(에러) return done(에러)

    //   if(결과2 == null) { //신청 이력이 없음
    //     res.redirect('/awaituse')
    //     console.log('/macstatusA1.post >> 최초 1회 - 현재 웨이팅 신청 가능')
    //     return
    //   }
    // })

    // // ------------------- 웨이팅 등록 재사용 -------------------
    // //db.waitinfo에서 userid가 로그인한 유저의 id인 데이터를 조회
    // db.collection('waitinfo').find({userid : req.user.id}).toArray(function(에러, 결과2) {
    //   if(에러) return done(에러)

    //   var 유저의웨이팅신청수 = 결과2.length
    //   console.log("/macstatusA1.post >> 1회 이상 - " + req.user.id + "의 웨이팅신청수(arr.length) : " + 유저의웨이팅신청수);

    //   var 찾았니
    //   var 찾은고유번호
    //   var 찾은기기번호
    //   for (let i = 0; i < 결과2.length; i++) {
    //     if (결과2[i].isUseWait == true) {
    //     찾았니 = "못찾음"         //로그인한 유저가 waitinfo에 없거나 이전에 사용 => 웨이팅 신청 가능
    //     }
    //     else {
    //       찾은고유번호 = 결과2[i].myNumber
    //       찾은기기번호 = 결과2[i].wmac
    //       찾았니 = "찾음"         //로그인한 유저가 waitinfo에 있음 => 웨이팅 신청 불가
    //     }
    //   }

    //   if (찾았니 == "못찾음") {
    //     res.redirect('awaituse');
    //     console.log('/macstatusA1.post >> 1회 이상 - 현재 웨이팅 신청 가능')
    //   }
    //   else if(찾았니 == "찾음"){
    //     // res.redirect('/branchinfoA1');
    //     // console.log('/macstatusA1.post >> 1회 이상 - 현재 웨이팅 신청 불가(되어있음)')


    //     //신청 시 부여된 myNumber 순서대로 웨이팅 사용하기 위해 <<페이지 이동>>
    //     //웨이팅 순서대로 하는 코드
    //     //db.counter에서 name이 대기인원수인 데이터를 조회
    //     db.collection('counter').findOne({name: '대기인원수'}, function(에러, 결과1){
    //       var 현재순서고유번호 = 결과1.totalUse + 1;

    //       //웨이팅 사용하기 위해 페이지 이동하는 코드
    //       if(현재순서고유번호 == 찾은고유번호) {  //자신의 차례라서 branchinfo로 이동 => 웨이팅 사용 가능
    //         console.log("/macstatusA1.post >> 현재순서고유번호 : " + 현재순서고유번호 + ", 찾은고유번호 : " + 찾은고유번호)

    //         res.redirect('/branchinfoA1');
    //         console.log('/macstatusA1.post >> 1회 이상 - 현재 웨이팅 신청 불가(되어있음)')
    //       }
    //       else {                                //자신의 차례 아니라서 bwaituse로 이동 => 웨이팅 사용 불가
    //         res.redirect('/bwaituse');
    //       }

    //     })

    //   }
    // })

  } 
})
//branchinfoA2로 redirect
app.post('/macstatusA2', function(req, res) {
  if (!req.session.nickname) {    //로그인X
    res.redirect('/awaituse');
    console.log("/macstatusA2.post >> 로그인X - 웨이팅 신청 불가")
  }
  else {                          //로그인O
    
    //모든 기기가 사용중이지 않을 때는 그냥 기기 사용 가능하도록.... -> 추가
    db.collection('branchUsage').findOne({branchName: 'A'}, function(에러, 결과){
      console.log('/macstatusA2.post >> 결과 : ' + 결과) 
      console.log('/macstatusA2.post >> 결과.isUseWmac1 is false : ' + 결과.isUseWmac1)
      console.log('/macstatusA2.post >> 결과.isUseWmac2 is false : ' + 결과.isUseWmac2)

      //모든 기기가 사용중이지 않을 때는 그냥 기기 사용 가능하도록.... -> 추가
      if(결과.isUseWmac1 == false && 결과.isUseWmac2 == false) { 
        res.redirect('/branchinfoA2');
        console.log('/macstatusA2.post >> 모든 기기가 사용중이지 않아 그냥 기기 사용 가능(모든 기기 false)')
      }
      //둘 중 하나의 기기가 사용중이지 않을 때는 그냥 기기 사용 가능하도록.... -> 추가
      else if(결과.isUseWmac1 == false && 결과.isUseWmac2 == true) { 
        res.redirect('/branchinfoA2');
        console.log('/macstatusA2.post >> 모든 기기가 사용중이지 않아 그냥 기기 사용 가능(모든 기기 false)')
      }
      else if(결과.isUseWmac1 == true && 결과.isUseWmac2 == false) { 
        res.redirect('/branchinfoA2');
        console.log('/macstatusA2.post >> 모든 기기가 사용중이지 않아 그냥 기기 사용 가능(모든 기기 false)')
      }
      //모든 기기가 사용중일 때는 웨이팅 신청 가능하도록....
      else{
        // ------------------- 웨이팅 등록 최초 1회 -------------------
        //db.waitinfo에서 userid가 로그인한 유저의 id인 데이터를 조회
        db.collection('waitinfo').findOne({userid : req.user.id}, function(에러, 결과2) {
          if(에러) return done(에러)

          if(결과2 == null) { //신청 이력이 없음
            res.redirect('/awaituse')
            console.log('/macstatusA2.post >> 최초 1회 - 현재 웨이팅 신청 가능')
            return
          }
        })

        // ------------------- 웨이팅 등록 재사용 -------------------
        //db.waitinfo에서 userid가 로그인한 유저의 id인 데이터를 조회
        db.collection('waitinfo').find({userid : req.user.id}).toArray(function(에러, 결과2) {
          if(에러) return done(에러)

          var 유저의웨이팅신청수 = 결과2.length
          console.log("/macstatusA2.post >> 1회 이상 - " + req.user.id + "의 웨이팅신청수(arr.length) : " + 유저의웨이팅신청수);

          var 찾았니
          var 찾은고유번호
          var 찾은기기번호
          for (let i = 0; i < 결과2.length; i++) {
            if (결과2[i].isUseWait == true) {
            찾았니 = "못찾음"         //로그인한 유저가 waitinfo에 없거나 이전에 사용 => 웨이팅 신청 가능
            }
            else {
              찾은고유번호 = 결과2[i].myNumber
              찾은기기번호 = 결과2[i].wmac
              찾았니 = "찾음"         //로그인한 유저가 waitinfo에 있음 => 웨이팅 신청 불가
            }
          }

          if (찾았니 == "못찾음") {
            res.redirect('awaituse');
            console.log('/macstatusA2.post >> 1회 이상 - 현재 웨이팅 신청 가능')
          }
          else if(찾았니 == "찾음"){
            // res.redirect('/branchinfoA2');
            // console.log('/macstatusA2.post >> 1회 이상 - 현재 웨이팅 신청 불가(되어있음)')


            //신청 시 부여된 myNumber 순서대로 웨이팅 사용하기 위해 <<페이지 이동>>
            //웨이팅 순서대로 하는 코드
            //db.counter에서 name이 대기인원수인 데이터를 조회
            db.collection('counter').findOne({name: '대기인원수'}, function(에러, 결과1){
              var 현재순서고유번호 = 결과1.totalUse + 1;

              //웨이팅 사용하기 위해 페이지 이동하는 코드
              if(현재순서고유번호 == 찾은고유번호) {  //자신의 차례라서 branchinfo로 이동 => 웨이팅 사용 가능
                console.log("/macstatusA2.post >> 현재순서고유번호 : " + 현재순서고유번호 + ", 찾은고유번호 : " + 찾은고유번호)

                res.redirect('/branchinfoA2');
                console.log('/macstatusA2.post >> 1회 이상 - 현재 웨이팅 신청 불가(되어있음)')
              }
              else {                                //자신의 차례 아니라서 bwaituse로 이동 => 웨이팅 사용 불가
                res.redirect('/bwaituse');
              }

            })
          }
        })

      }
    })

  } 
})


//6. 유의사항 페이지 이동
app.get('/caution', function(req, res) {
  if (!req.session.nickname) {
    res.render('caution.ejs', {session: "true"});
  }
  else {
    res.render('caution.ejs', {session: "false"});
  }
})


//7. 웨이팅 등록 페이지 이동
app.get('/wait', isLogin, function(req, res) {
  console.log("/wait.get >> req.user : " + req.user);

    //DB에서 데이터 꺼내기 - DB.counter 내의 대기인원수를 찾음
    db.collection('counter').findOne({name : '대기인원수'}, function(에러, 결과){
      console.log("/wait.get >> 웨이팅 총대기인원수 : " + 결과.totalWait) //결과.totalWait = 대기인원수
    
      //찾은 데이터를 wait.ejs 안에 넣기
      //req.user를 사용자라는 이름으로, 결과를 counters라는 이름으로 보내기
      res.render('wait.ejs', {사용자 : req.user, counters : 결과})
    })
})

//수정본 - 모든 기기가 작동중인 경우만 웨이팅 신청 가능
app.post('/wait', isLogin, function(req, res){
  //지점별로 모든 기기가 작동중인지 확인 -> 모두 작동중일 경우만 웨이팅 신청 가능
  //A지점---------------------------------------------------------------------------------------
  //db.branchUsage에서 branchName이 A인 데이터를 조회
  db.collection('branchUsage').findOne({branchName: 'A'}, function(에러, 결과){
    if (에러) return done(에러)
  
    if(결과 != null) { //모든 기기가 사용중인 경우(모두 true)
      if(결과.isUseWmac1 == true && 결과.isUseWmac2 == true) {
        console.log('/wait.post >> db.branchUsage - A지점의 모든 기기가 사용중')

        //웨이팅 신청가능으로 WaitReq() 호출
        WaitReq();
      }
      else {
        res.render('waitfail.ejs')
        console.log('/wait.post >> db.branchUsage - A지점의 모든 기기가 사용중이지 않음')
        console.log('/wait.post >> db.branchUsage - A지점의 Wmac1의 상태 >>> ' + 결과.isUseWmac1)
        console.log('/wait.post >> db.branchUsage - A지점의 Wmac2의 상태 >>> ' + 결과.isUseWmac2)
      }   
    }
    else {
      console.log('/wait.post >> db.branchUsage - A지점의 조회 결과가 null')
    }
  })


  //웨이팅 신청하는 함수
  function WaitReq() {
    //db.counter에서 name이 대기인원수인 데이터를 조회
    db.collection('counter').findOne({name: '대기인원수'}, function(에러, 결과1){
      var waitinfo개수 = 결과1.totalWait + 결과1.totalUse

      //db.waitinfo에서 userid가 로그인한 유저의 id인 데이터를 조회 
      db.collection('waitinfo').find({userid : req.user.id}).toArray(function(에러, 결과2) {
        if(에러) return done(에러)

        // ------------------- 웨이팅 등록 최초 1회 ---------------
        if(결과2.length == 0) { //신청 이력이 없음

          //db.waitinfo에 웨이팅 신청 정보를 저장(_id : waitinfo개수+1로 새로운 데이터를 저장)
          db.collection('waitinfo').insertOne( {_id : waitinfo개수 + 1, 
            myNumber : waitinfo개수 + 1, userid : req.user.id, wmac : 0, isUseWait : false} , function(에러, 결과){
            
            console.log("/wait.post >> 결과 : " + 결과)
            console.log("/wait.post >> 에러 : " + 에러)

            if (결과 != undefined) {
              console.log('/wait.post >> 최초 1회 - 대기인원 데이터 저장 성공');

              //db.counter에서 name이 대기인원수인 totalWait을 +1 증가하여 수정(즉, 총대기인원수+1)
              //operator 종류 : $set(변경), $inc(증가), $min(기존값보다 적을 때만 변경), $rename(key값 이름변경)
              db.collection('counter').updateOne({name: '대기인원수'}, {$inc: {totalWait:1} }, function(에러, 결과){
                if(에러){return console.log(에러)}
                res.redirect('/waitsuccess')
                console.log('/wait.post >> 최초 1회 - 웨이팅 신청 성공')
              })
            }
            else {
              res.redirect('/wait')
            }
          })

        }
        // ------------------- 웨이팅 등록 1회 이상(재사용) ---------------
        else {
          var 찾았니
          for (let i = 0; i < 결과2.length; i++) {
            if (결과2[i].isUseWait == true) {
              찾았니 = "못찾음"   //로그인한 유저가 waitinfo에 없거나 이전에 사용 => 웨이팅 신청 가능
            }
            else {
              찾았니 = "찾음"     //로그인한 유저가 waitinfo에 있음 => 웨이팅 신청 불가
            }
          }

          if (찾았니 == "못찾음") {
            //db.waitinfo에 웨이팅 신청 정보를 저장(_id : waitinfo개수+1로 새로운 데이터를 저장)
            db.collection('waitinfo').insertOne( {_id : waitinfo개수 + 1, myNumber : waitinfo개수 + 1, userid : req.user.id, wmac : 0, isUseWait : false} , function(에러, 결과){
              console.log('/wait.post >> 1회 이상 - 대기인원 데이터 저장 성공');
              console.log("/wait.post >> 결과 : " + 결과)
              console.log("/wait.post >> 에러 : " + 에러)

              if (결과 != undefined) {
                //db.counter에서 name이 대기인원수인 totalWait을 +1 증가하여 수정(즉, 총대기인원수+1)
                db.collection('counter').updateOne({name: '대기인원수'}, {$inc: {totalWait:1} }, function(에러, 결과){
                  if(에러){return console.log(에러)}
                  res.redirect('/waitsuccess')
                  console.log('/wait.post >> 1회 이상 - 웨이팅 신청 성공')
                })
              }
              else {
                res.redirect('/wait')
              }
            })
          }
          else if (찾았니 == "찾음") {
            res.redirect('/waitalready')
            console.log('/wait.post >> 1회 이상 - 웨이팅 신청 실패(이유 : 웨이팅 신청 되어있음)')
          }
        }

      })
    })
  }
})


//7-1. 웨이팅 신청이 되어있으면 뿌려주는 페이지
app.get('/waitalready', isLogin, function(req, res) {
  console.log(req.user)
  res.render('waitalready.ejs')
})


//7-2. 웨이팅 신청 성공하면 뿌려주는 페이지
app.get('/waitsuccess', isLogin, function(req, res) {
  console.log(req.user)
  res.render('waitsuccess.ejs')
})


//8. 웨이팅 확인 페이지 이동 (+ 앞에 대기인원이 1명 남았을 때만 wmac 변경 가능)
app.get('/waitcheck', isLogin, function(req, res) {
  console.log("/waitcheck.get >> req.user : " + req.user);

  // ------------------- 웨이팅 등록 최초 1회 -------------------
  //db.waitinfo에서 userid가 로그인한 유저의 id인 데이터를 조회
  db.collection('waitinfo').findOne({userid : req.user.id}, function(에러, 결과2) {
    if(에러) return done(에러)

    if(결과2 == null) { //신청 이력이 없음
      res.redirect('/awaituse')
      console.log('/waitcheck.get >> 최초 1회 - 웨이팅 사용 후 확인(미신청 후 확인)');
      return
    }
    else{
      console.log('/waitcheck.get >> 최초 1회 - 웨이팅 사용 전 확인')
    }
  })

  // ------------------- 웨이팅 등록 재사용 -------------------
  //db.waitinfo에서 userid가 로그인한 유저의 id인 데이터를 조회
  db.collection('waitinfo').find({userid : req.user.id}).toArray(function(에러, 결과2) {
    if(에러) return done(에러)

    var 유저의웨이팅신청수 = 결과2.length
    console.log("/waitcheck.get >> 1회 이상 - " + req.user.id + "의 웨이팅신청수(arr.length) : " + 유저의웨이팅신청수);

    var 찾았니
    var 찾은기기번호
    var 찾은고유번호
    for (let i = 0; i < 결과2.length; i++) {
      if (결과2[i].isUseWait == true) {
        찾았니 = "못찾음"         //로그인한 유저가 waitinfo에 없거나 이전에 사용 => 웨이팅 신청 가능
      }
      else {
        찾은기기번호 = 결과2[i].wmac
        찾은고유번호 = 결과2[i].myNumber
        찾았니 = "찾음"          //로그인한 유저가 waitinfo에 있음 => 웨이팅 신청 불가
      }
    }

    db.collection('counter').findOne({name: '대기인원수'}, function(에러, 결과3) { 
      var totalUse = 결과3.totalUse
      var left = 찾은고유번호 - totalUse - 1

        //wmac 변경 부분
        if(찾은기기번호 == 0 && left == 0){ //wmac이 0 + 앞에 남은 인원이 0인 경우에 wmac 수정
          //기기의 타이머가 1분 기준이면 30초 이하로 남았을 때 지정된 wmac으로 수정
          if(min1 == 0 && sec1 <= 30) { //Timer1의 시간이 30초 남았을 때 = wamc1이 30초 남았을 때
            //wmac1을 1로 update하는 부분
            db.collection('waitinfo').updateOne({userid : req.user.id}, {$set: {wmac:1} }, function(에러, 결과){
              console.log("/waitcheck.get >> Timer1이 30초 이하로 남아 wmac을 0에서 1로 수정")
            })
          }
          else if(min2 == 0 && sec2 <= 30) { //Timer2의 시간이 30초 남았을 때 = wamc2이 30초 남았을 때
            //wmac2을 2로 update하는 부분
            db.collection('waitinfo').updateOne({userid : req.user.id}, {$set: {wmac:2} }, function(에러, 결과){
              console.log("/waitcheck.get >> Timer2이 30초 이하로 남아 wmac을 0에서 2로 수정")
            })
          }
          else {
            console.log("/waitcheck.get >> wmac 변경 오류")
            console.log("min1 : " + min1 + ", sec1 : " + sec1)
            console.log("min2 : " + min2 + ", sec2 : " + sec2)
          }
        }
        else if(찾은기기번호 == 0 && left == 1){ //wmac이 0 + 앞에 남은 인원이 1인 경우에 wmac 수정
          console.log('/waitcheck.get >> 1회 이상 - left is 1? : ' + left)
          console.log('/waitcheck.get >> 1회 이상 - wmac이 0 + 앞에 남은 인원이 1로 wmac 수정')

          //웨이팅을 사용하지 않은 사람 중..
          db.collection('waitinfo').find({isUseWait : false}).toArray(function(에러, 결과4) { 
            console.log('/waitcheck.get >> waitinfo에서 isUseWait이 false인 경우 : ' + 결과4)

            //for (let i = 0; i < 결과4.length; i++) {
              if(결과4[0].wmac == 1) {      //wmac을 1로 지정받은 사람이 있으면
                //wmac을 2로 수정
                db.collection('waitinfo').updateOne({userid : req.user.id}, {$set: {wmac:2} }, function(에러, 결과){
                  console.log("/waitcheck.get >> wmac을 1로 지정받은 사람이 있어 wmac을 0에서 2로 수정")
                })       
              }
              else if(결과4[0].wmac == 2) { //wmac을 2로 지정받은 사람이 있으면
                //wmac을 1로 수정
                db.collection('waitinfo').updateOne({userid : req.user.id}, {$set: {wmac:1} }, function(에러, 결과){
                  console.log("/waitcheck.get >> wmac을 1로 지정받은 사람이 있어 wmac을 0에서 1로 수정")
                })
              }
              // else if(결과4[0].wmac == 0) { //wmac이 아직 0으로 지정되지 않았다면
              //   //대기
              //   return res.redirect('/') //bwaituse에서 앞에 남은 사람이 0명이 아니라고 말해주면 좋을 듯
              // }
            //}

          })
        }
        // else if(찾은기기번호 == 0) {
        //   //대기
        //   return res.redirect('/')
        // }
    })

    if (찾았니 == "못찾음") {
      console.log('/waitcheck.get >> 1회 이상 - 웨이팅 사용 후 확인')
      return res.redirect('/awaituse')
    }
    else if(찾았니 == "찾음"){     
      console.log('/waitcheck.get >> 1회 이상 - 웨이팅 사용 전 확인') 
      return res.redirect('/bwaituse')
    }

  })
})


//8-1. 웨이팅 등록하고 기기 작동시키기 전
// 본인 대기번호와 앞에 몊명 남았는지 확인 가능
app.get('/bwaituse', isLogin, function(req, res) {
  console.log("/bwaituse.get >> req.user : " + req.user);
  
  //db.waitinfo에서 userid가 로그인한 유저의 id인 데이터를 조회
  db.collection('waitinfo').find({userid : req.user.id}).toArray(function(에러, 결과2) {
    if(에러) return done(에러)

    console.log("/bwaituse.get >> " + req.user.id + "의 웨이팅신청수 : " + 결과2.length);

    var 찾았니
    var 찾은고유번호
    var 찾은기기번호
    for (let i = 0; i < 결과2.length; i++) {
      if (결과2[i].isUseWait == true) {
        찾았니 = "못찾음"         //로그인한 유저가 waitinfo에 없거나 이전에 사용 => 웨이팅 신청 가능
      }
      else {
        찾은고유번호 = 결과2[i].myNumber
        찾은기기번호 = 결과2[i].wmac
        찾았니 = "찾음"         //로그인한 유저가 waitinfo에 있음 => 웨이팅 신청 불가
      }
    }

    if (찾았니 == "찾음") {
      // var myNumber = 결과2[결과2.length - 1].myNumber
      // console.log("/bwaituse.get >> 본인웨이팅번호 : " + myNumber)

      //db.counter에서 name이 대기인원수인 데이터 찾기
      db.collection('counter').findOne({name: '대기인원수'}, function(에러, 결과3){
        var totalWait = 결과3.totalWait
        var totalUse = 결과3.totalUse
        var left = 찾은고유번호 - totalUse - 1

        console.log("/bwaituse.get >> 총대기인원수 : " + totalWait)
        console.log("/bwaituse.get >> 총대기사용수 : " + totalUse)
        console.log("/bwaituse.get >> 앞에남은인원수 : " + left)

        //찾은 데이터를 bwaituse.ejs 안에 넣기(req.user를 사용자라는 이름으로 보내기)
        res.render('bwaituse.ejs', {사용자 : req.user, 본인웨이팅번호 : 찾은고유번호, 
                                    본인기기번호 : 찾은기기번호, 대기사용수 : totalUse})
      })
    }
    else if(찾았니 == "못찾음"){
      console.log('NONE')
    }
  })
})

//8-2. 웨이팅 등록하고 기기 작동시킨 후
app.get('/awaituse', isLogin, function(req, res) {
  console.log("/awaituse.get >> req.user : " + req.user);
  res.render('awaituse.ejs')
})


//9. 마이페이지
app.get('/mypage', isLogin, function(req, res) {
  console.log("/mypage.get >> req.user : " + req.user);

  if (!req.session.nickname) { res.render('mypage.ejs', {session: "true"}); }
  else                       { res.render('mypage.ejs', {session: "false", 사용자 : req.user}); }
})


// 요금정산 페이지
app.get('/charge', function(req, res) {
  res.render('charge.ejs')
})


//10. 지도 (카카오맵)
app.get('/map', function(req, res) {
  const KAKAO_MAP_KEY = process.env.KAKAO_MAP_KEY;
  db.collection('branch').find().toArray(function(에러, 결과) {
    if (에러) return console.log(에러)

    var store = new Array();
    let name, lat, lng;

    for (let i = 0; i < 결과.length; i++) {

      name = 결과[i].name;
      lat = 결과[i].lat;
      lng = 결과[i].lng;

      store[i] = {name, lat, lng};
      
    }
    res.render('map.ejs', {store, KAKAO_MAP_KEY});
  })
})


//11. 지점 상세정보 페이지 이동 - 원본
app.get('/branchinfo', function (req, res) {
  if (!req.session.nickname) {    //로그인X
    res.render('branchinfo.ejs', { session: "true" });
  }
  else {    //로그인O
    res.render('branchinfo.ejs', { session: "false" });
  }
})

// 수정본 - 신청 시 부여된 myNumber 순서대로 웨이팅 사용 가능 (+추가예정 : 부여된 wmac로 웨이팅 사용 가능)
app.post('/branchinfo', function(req, res) {
  // ------------------- 웨이팅 등록 최초 1회 -------------------
  //db.waitinfo에서 userid가 로그인한 유저의 id인 데이터를 조회
  db.collection('waitinfo').findOne({userid : req.user.id}, function(에러, 결과2) {
    if(에러) return done(에러)

    //로그인한 유저가 waitinfo에 없다면.. -> 웨이팅 신청 한 번도 안함
    if(결과2 == null) {
      res.redirect('/awaituse')
      console.log('/branchinfo.post >> 최초 1회 - 웨이팅 사용 후 확인(미신청 후 waitcheck)');
      return
    }
    else{
      console.log('/branchinfo.post >> null값이 아니면 등록 재사용으로..')
    }
  })

  // ------------------- 웨이팅 등록 재사용 -------------------
  //db.waitinfo에서 userid가 로그인한 유저의 id인 데이터를 조회
  db.collection('waitinfo').find({userid : req.user.id}).toArray(function(에러, 결과2) {
    if(에러) return done(에러)

    console.log("/branchinfo.post >> 1회 이상 - " + req.user.id + "의 웨이팅신청수 : " + 결과2.length);

    var 찾았니
    var 찾은고유번호
    var 선택한버튼
    var 찾은기기번호
    for (let i = 0; i < 결과2.length; i++) {
      if (결과2[i].isUseWait == true) {
        찾았니 = "못찾음"         //로그인한 유저가 waitinfo에 없거나 이전에 사용 => 웨이팅 신청 가능
      }
      else {
        찾은고유번호 = 결과2[i].myNumber
        찾은기기번호 = 결과2[i].wmac
        찾았니 = "찾음"           //로그인한 유저가 waitinfo에 있음 => 웨이팅 신청 불가
      }
    }

    if (찾았니 == "못찾음") {
      res.redirect('/awaituse')
      console.log('/branchinfo.post >> 1회 이상 - 웨이팅 사용 후 확인(미신청 후 확인)')
    }
    else if(찾았니 == "찾음"){
      //1. 신청 시 부여된 myNumber 순서대로 웨이팅 사용
      // 1) 만약에 웨이팅번호 = totalUse(사용인원) + 1것과 db에서 찾은 myNumber가 같다면 => 웨이팅 순서대로 하는 코드
      //db.counter에서 name이 대기인원수인 데이터를 조회
      db.collection('counter').findOne({name: '대기인원수'}, function(에러, 결과1){
        var waitinfo개수 = 결과1.totalWait + 결과1.totalUse;
        var 현재순서고유번호 = 결과1.totalUse + 1;

        if(현재순서고유번호 == 찾은고유번호) {
          console.log("/branchinfo.post >> waitinfo개수 : " + waitinfo개수)
          console.log("/branchinfo.post >> 현재순서고유번호 : " + 현재순서고유번호 + ", 찾은고유번호 : " + 찾은고유번호)

          //각 branchinfo에서 선택한 버튼과 waitinfo에서 찾은 wmac이 같은 경우만 웨이팅 사용(waitUse()호출)
          if(req.body.macNumber == "A1"){       //branchinfoA1에서 클릭한 시작버튼(wmac1)
            선택한버튼 = 1
            console.log("/branchinfo.post >> macstatusA에서 선택한 버튼 : " + 선택한버튼)
          }
          else if(req.body.macNumber == "A2"){  //branchinfoA2에서 클릭한 시작버튼(wmac2)
            선택한버튼 = 2
            console.log("/branchinfo.post >> macstatusA에서 선택한 버튼 : " + 선택한버튼)
          }

          console.log("/branchinfo.post >> waitinfo에서 찾은 wmac 기기 번호 : " + 찾은기기번호)
          
          if(찾은기기번호 == 선택한버튼){
            console.log("/branchinfo.post >> 찾은기기번호 == 선택한버튼")
            // 2) 웨이팅 사용 => 웨이팅 사용 코드
            WaitUse()
          }
          else { 
            console.log("/branchinfo.post >> 찾은기기번호 != 선택한버튼")
            //res.render('bwaituse.ejs')
            res.redirect('/bwaituse')
          }

        }
      })

      //웨이팅 사용하는 함수
      function WaitUse() {
        //db.waitinfo에서 myNumber가 찾은고유번호인 isUseWait을 true로 수정(즉, 웨이팅 사용함)
        db.collection('waitinfo').updateOne({myNumber : 찾은고유번호}, { $set: {isUseWait:true} }, function(에러3, 결과){
          if(에러3){return console.log(에러3)}

          //db.waitinfo에서 userid가 로그인한 유저의 id인 데이터를 조회
          db.collection('waitinfo').find({userid : req.user.id}).toArray(function(에러, 결과3) {
            var 대기번호 = 결과3[결과3.length - 1].myNumber
            var 웨이팅사용여부 = 결과3[결과3.length - 1].isUseWait
            console.log("/branchinfo.post >> 대기번호 : " + 대기번호)
            console.log("/branchinfo.post >> 웨이팅사용여부 is true : " + 웨이팅사용여부)

            //사용한 회원 관리
            if(웨이팅사용여부){ //웨이팅을 사용했다면..
              //db.counter에서 name이 대기인원수인 totalWait를 -1하여 수정(즉, 총대기인원수-1)
              db.collection('counter').updateOne({name: '대기인원수'}, { $inc: {totalWait:-1} }, function(에러1, 결과) {
                if(에러1){return console.log(에러1)}

                //db.counter에서 name이 대기인원수인 totalUse를 +1하여 수정(즉, 총대기사용수+1)
                db.collection('counter').updateOne({name: '대기인원수'}, { $inc: {totalUse:1} }, function(에러2, 결과) {
                  if(에러2){return console.log(에러2)}

                  console.log('/branchinfo.post >> 웨이팅 사용(isUseWait is true) 후 사용한 회원 관리(db.counter 수정) 성공')
                  //return res.redirect('/')   //>>>>>>>>>>>>>>> redirect가 안먹혀서 /btncheckA1.post 시 redirect 추가

                })
              })
            }
            else { res.redirect('/') }
          })
        })
      }

    }
  })
})

// 지점 상세정보 페이지 - A지점 wmac1
app.get('/branchinfoA1', function (req, res) {
  if (!req.session.nickname) {    //로그인X
    res.render('branchinfoA1.ejs', { session: "true" });
  }
  else {                          //로그인O
    res.render('branchinfoA1.ejs', { session: "false" });
  }
})
// 지점 상세정보 페이지 - A지점 wmac2
app.get('/branchinfoA2', function (req, res) {
  if (!req.session.nickname) {    //로그인X
    res.render('branchinfoA2.ejs', { session: "true" });
  }
  else {                          //로그인O
    res.render('branchinfoA2.ejs', { session: "false" });
  }
})


//branchinfo 버튼 클릭 확인 - 원본
app.post('/btncheck', function(req, res) {
  console.log("/btncheck.post >> branchinfo 버튼 클릭 > 타이머 실행")
  StartTimer(); 
})

//branchinfoA1 버튼 클릭 확인 - A지점 wmac1
app.post('/btncheckA1', function(req, res) {

  res.redirect('/')
  console.log("/btncheckA1.post >> branchinfoA1 버튼 클릭")

  var 선택한버튼 = 1
  db.collection('waitinfo').find({userid : req.user.id}).toArray(function(에러, 결과2) {
    var 찾은기기번호
    var 찾은사용여부
    for (let i = 0; i < 결과2.length; i++) {
      찾은기기번호 = 결과2[i].wmac
      찾은사용여부 = 결과2[i].isUseWait
    }

    //웨이팅 신청없이 사용하는 경우
    if(결과2.length == null || 찾은사용여부 == true) {
      console.log("/btncheckA1.post >> 웨이팅 신청 없이 사용하는 사람들")
      console.log("/btncheckA1.post >> 타이머1 실행")

      //타이머 시작(server) - browser의 타이머1에 시간 전달
      StartTimerA1();

      //db.branchUsage에서 branchName이 A인 isUseWmac을 true로 변경 => 사용중임
      db.collection('branchUsage').updateOne({branchName : 'A'}, {$set : {isUseWmac1:true} }, function(에러, 결과){
        if(에러){return console.log(에러)}
        console.log('/btncheckA1.post >> db.branchUsage - A지점의 Wmac1이 true로 수정(즉, A지점 1번 세탁기 사용중)')
      })
    }

    //웨이팅 신청하고 사용하는 경우
    if(찾은기기번호 == 선택한버튼){
      console.log("/btncheckA1.post >> 찾은기기번호 == 선택한버튼")
      console.log("/btncheckA1.post >> 타이머1 실행")

      //타이머 시작(server) - browser의 타이머1에 시간 전달
      StartTimerA1();

      //db.branchUsage에서 branchName이 A인 isUseWmac을 true로 변경 => 사용중임
      db.collection('branchUsage').updateOne({branchName : 'A'}, {$set : {isUseWmac1:true} }, function(에러, 결과){
        if(에러){return console.log(에러)}
        console.log('/btncheckA1.post >> db.branchUsage - A지점의 Wmac1이 true로 수정(즉, A지점 1번 세탁기 사용중)')
      })
    }
    else { 
      console.log("/btncheckA1.post >> 찾은기기번호 != 선택한버튼")
      //res.render('bwaituse.ejs')
      res.redirect('/bwaituse')
    }

  })


  // res.redirect('/')
  // console.log("/btncheckA1.post >> branchinfoA1 버튼 클릭 > 타이머1 실행")

  // //타이머 시작(server) - browser의 타이머2에 시간 전달
  // StartTimerA1(); 

  // //db.branchUsage에서 branchName이 A인 isUseWmac1를 true로 변경 => 사용중임
  // db.collection('branchUsage').updateOne({branchName : 'A'}, {$set : {isUseWmac1:true} }, function(에러, 결과){
  //   if(에러){return console.log(에러)}
  //   console.log('/btncheckA1.post >> db.branchUsage - A지점의 Wmac1가 true로 수정(즉, A지점 1번 세탁기 사용중)')
  // })

})
//branchinfoA2 버튼 클릭 확인 - A지점 wmac2
app.post('/btncheckA2', function(req, res) {
  res.redirect('/')
  console.log("/btncheckA2.post >> branchinfoA2 버튼 클릭 > 타이머2 실행")

  //타이머 시작(server) - browser의 타이머2에 시간 전달
  StartTimerA2(); 

  //db.branchUsage에서 branchName이 A인 isUseWmac2를 true로 변경 => 사용중임
  db.collection('branchUsage').updateOne({branchName : 'A'}, {$set : {isUseWmac2:true} }, function(에러, 결과){
    if(에러){return console.log(에러)}
    console.log('/btncheckA2.post >> db.branchUsage - A지점의 Wmac2가 true로 수정(즉, A지점 2번 세탁기 사용중)')
  })
})
