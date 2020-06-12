const express = require ('express')
const bodyParser = require('body-parser')
const app = express()

//Here we are configuring express to use body-parser as middle-ware for rest services only.
//app.use(bodyParser.urlencoded({ extended: false }));
//app.use(bodyParser.json());
var jsonParser = bodyParser.json();


const { PORT=4004 } = process.env
const cds = require('@sap/cds')

// add security handling via passport
/*var passport = require("passport");
var xssec = require("@sap/xssec"); 
var xsenv = require("@sap/xsenv");
passport.use("JWT", new xssec.JWTStrategy(xsenv.getServices({
	uaa: {
		tag: "xsuaa"
	}
}).uaa));

app.use(passport.initialize());
app.use(passport.authenticate("JWT", {
	session: false
}));*/

initcds(app);
initdrmapi(app);
app.get('/', (req, res) => res.send('Welcome to Data Retention Manager Demo !!!'))


app.listen(PORT , () => console.log(`Example app listening at http://localhost:${PORT}`))

async function initcds (app) {
   // await cds.connect.to ('db');
    const options = {
    "in_memory": false,
    "service": 'all',
    "from": '*',
    "app": app
  }
    const model = cds.model = await cds.load (options.from)
   // bootstrap --in-memory db if requested
    if (options.in_memory) cds.db = await cds.deploy (model,options)

    // connect to primary database if required
    else if (cds.requires.db) cds.db = await cds.connect.to('db')


    await cds.serve(options).from(model).in(app);
}

async function initdrmapi(app) {
  app.get('/drm/legalEntities/:dataSubjectRole', async (req, res) => {
    console.log("Data Subject Role: "+req.params.dataSubjectRole)
    
    const legalEntities = [];
    let dbLegalEntities = [];
    try{
     // console.log(cds.entities.LegalEntities);  
    dbLegalEntities = await cds.read('sap.capire.bookshop.LegalEntities').where({role: req.params.dataSubjectRole})
    }
    catch(e)
    {
       console.log(e);
    }
   for (let each of dbLegalEntities) {
        const legalEnties = {
        "value" : each.ID,
        'valueDesc' : each.description
       }
       legalEntities.push(legalEnties)

    }
    
    
    res.send(JSON.stringify(legalEntities))
  })

  app.get('/drm/conditionalFieldValues/:conditionFieldName', (req, res) => {
    console.log("DConditionFieldName : "+req.params.conditionFieldName)  
    const legalEnties = {
        "value" : "1010",
        'valueDesc' : "Europe Company"
    }
    res.send(JSON.stringify([legalEnties]))
  })

  app.post('/drm/dataSubjectEndofBusiness', jsonParser,async (req,res) => {
    const reqBody = req.body
    console.log(reqBody);
    let reply = {
      "dataSubjectExpired": true,
      "dataSubjectNotExpiredReason": ""
    }
    try{
    if(reqBody.dataSubjectRole === 'Customer' && reqBody.legalGround ==='Order'){
      let orders = []
     orders = await SELECT.from('sap.capire.bookshop.Orders').where({customer_ID: Number(reqBody.dataSubjectID)}) 
     if(orders.length === 0)
     {
      res.status(204).send();
      return;
     }
     else{
      for (let each of orders) {
       if(each.paymentDate === null)
       {
        reply.dataSubjectExpired = false
        reply.dataSubjectNotExpiredReason = 'Orders are still not paid'  
        res.status(200).send(reply);
        return;
       }
      }
      res.status(200).send(reply);
     }

    }
  }catch(e)
  {
     console.log(e);
  }
  })


  app.post('/drm/dataSubjectLegalEntities', jsonParser,async (req,res) => {
    const reqBody = req.body
    console.log(reqBody);
    let reply = []
    try{
      if(reqBody.dataSubjectRole === 'Customer' && reqBody.legalGround ==='Order'){
        const legalEntity = await SELECT.one.from('AdminService.Customers',['legalEntity']).where({ID:Number(reqBody.dataSubjectID)}) 
        if(legalEntity === null)
        {
          res.status(204).send()
          return;
        }
        reply.push(legalEntity);
      }
      res.status(200).send(reply);
      return;
    
  }catch(e)
  {
     console.log(e);
  }
  })
}


    