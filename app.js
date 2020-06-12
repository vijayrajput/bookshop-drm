const express = require('express')
const bodyParser = require('body-parser')
const app = express()

//Here we are configuring express to use body-parser as middle-ware for rest services only.
//app.use(bodyParser.urlencoded({ extended: false }));
//app.use(bodyParser.json());
var jsonParser = bodyParser.json();


const { PORT = 4004 } = process.env
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


app.listen(PORT, () => console.log(`Example app listening at http://localhost:${PORT}`))

async function initcds(app) {
    // await cds.connect.to ('db');
    const options = {
        "in_memory": false,
        "service": 'all',
        "from": '*',
        "app": app
    }
    const model = cds.model = await cds.load(options.from)
    // bootstrap --in-memory db if requested
    if (options.in_memory) cds.db = await cds.deploy(model, options)

    // connect to primary database if required
    else if (cds.requires.db) cds.db = await cds.connect.to('db')


    await cds.serve(options).from(model).in(app);
}

async function initdrmapi(app) {
    app.get('/drm/legalEntities/:dataSubjectRole', async (req, res) => {
        console.log("Data Subject Role: " + req.params.dataSubjectRole)

        const legalEntities = [];
        let dbLegalEntities = [];
        try {
            // console.log(cds.entities.LegalEntities);  
            dbLegalEntities = await cds.read('sap.capire.bookshop.LegalEntities').where({ role: req.params.dataSubjectRole })
        }
        catch (e) {
            console.log(e);
        }
        for (let each of dbLegalEntities) {
            const legalEnties = {
                "value": each.ID,
                'valueDesc': each.description
            }
            legalEntities.push(legalEnties)

        }


        res.send(legalEntities)
    })

    app.get('/drm/conditionalFieldValues/:conditionFieldName', (req, res) => {
        console.log("DConditionFieldName : " + req.params.conditionFieldName)
        const legalEnties = {
            "value": "1010",
            'valueDesc': "Europe Company"
        }
        res.send([legalEnties])
    })

    app.post('/drm/dataSubjectEndofBusiness', jsonParser, async (req, res) => {
        const reqBody = req.body
        console.log(reqBody);
        let reply = {
            "dataSubjectExpired": true,
            "dataSubjectNotExpiredReason": ""
        }
        try {
            if (reqBody.dataSubjectRole === 'Customer' && reqBody.legalGround === 'Order') {
                let orders = []
                orders = await SELECT.from('AdminService.Orders').where({ customer_ID: Number(reqBody.dataSubjectID) })
                if (orders.length === 0) {
                    res.status(204).send();
                    return;
                }
                else {
                    for (let each of orders) {
                        if (each.paymentDate === null) {
                            reply.dataSubjectExpired = false
                            reply.dataSubjectNotExpiredReason = 'Orders are still not paid'
                            res.status(200).send(reply);
                            return;
                        }
                    }
                    res.status(200).send(reply);
                }

            }
        } catch (e) {
            console.log(e);
        }
    })


    app.post('/drm/dataSubjectLegalEntities', jsonParser, async (req, res) => {
        const reqBody = req.body
        console.log(reqBody);
        let reply = []
        try {
            if (reqBody.dataSubjectRole === 'Customer' && reqBody.legalGround === 'Order') {
                const legalEntity = await SELECT.one.from('AdminService.Customers', ['legalEntity']).where({ ID: Number(reqBody.dataSubjectID) })
                if (legalEntity === null) {
                    res.status(204).send()
                    return;
                }
                reply.push(legalEntity);
            }
            res.status(200).send(reply);
            return;

        } catch (e) {
            console.log(e);
        }
    })

    app.post('/drm/dataSubjectRetentionStartDate', jsonParser, async (req, res) => {
        const reqBody = req.body
        console.log(reqBody);
        let reply = []
        try {
            if (reqBody.dataSubjectRole === 'Customer') {
                const orders = await SELECT.from('AdminService.Orders').where({ customer_ID: Number(reqBody.dataSubjectID) })
                if (orders.length === 0) {
                    return res.status(204).send();
                }
                else {
                    let retentionDate = null;
                    for (let each of orders) {
                        if (each[reqBody.startTime] === null) {
                            return res.status(204).send();
                        }
                        else {
                            if (retentionDate === null || retentionDate < each[reqBody.startTime])
                                retentionDate = each[reqBody.startTime]
                        }
                    }
                    const retentionmsg = {
                        "retentionID": reqBody.rulesConditionSet[0].retentionID,
                        "retentionStartDate": retentionDate
                    }
                    reply.push(retentionmsg)
                    return res.status(200).send(reply);
                }
            }
        } catch (e) {
            console.log(e);
        }
    })


    app.post('/drm/endofResidenceDataSubject', jsonParser, async (req, res) => {
        const reqBody = req.body
        console.log(reqBody);
        const transcation = cds.transaction(req);
        let customerStillValid = [];
        let customerNotUsed = [];
        let reply = {
            "success": []
        }
        try {
            if (reqBody.dataSubjectRole === 'Customer') {
                //let legalEntities = []
                for (let each of reqBody.legalEntitiesResidenceRules) {
                    //legalEntities.push(each.legalEntity)
                    const orders = await transcation.run(SELECT.from('AdminService.Orders').
                        where({ customer_ID: SELECT.from('AdminService.Customers', ['ID']).where({ legalEntity: each.legalEntity }) }))

                    //orders.sort((a, b) => a.customer_ID > b.customer_ID);
                    for (let order of orders) {
                        if (customerStillValid.indexOf(order.customer_ID) < 0) {
                            let payDate = new Date(order.paymentDate),
                                resiDate = new Date(each.residenceRules[0].residenceDate);
                            if (order.paymentDate === null || payDate > resiDate) { /// not paid or paymentDate is grater than residence Date
                                customerStillValid.push(order.customer_ID);
                                customerNotUsed = customerNotUsed.filter(item => item !== order.customer_ID)  // remove valid Customer from Customer Not Used Array

                            }
                            else if (customerNotUsed.indexOf(order.customer_ID) < 0) {
                                customerNotUsed.push(order.customer_ID);
                            }
                        }
                    }
                }
                for (let customer of customerNotUsed) {
                    const cust = { "dataSubjectID": customer }
                    reply.success.push(cust);
                }
                return res.status(200).send(reply)
            }
        } catch (e) {
            console.log(e);
        }
    })


    app.post('/drm/dataSubjectInformation', jsonParser, async (req, res) => {
        const reqBody = req.body
        console.log(reqBody);
        let reply = []
        try {
            if (reqBody.dataSubjectRole === 'Customer') {
                const customers = await SELECT.from('AdminService.Customers', ['ID', 'name']).where({ ID: reqBody.dataSubjectIds })
                for (let customer of customers) {
                    let custData = {
                        "dataSubjectId": (customer.ID).toString(),
                        "name": customer.name,
                        "emailId": ""
                    }
                    reply.push(custData);
                }
            }
            return res.status(200).send(reply);
        } catch (e) {
            console.log(e);
        }
    })

  
    app.post('/drm/deleteDSLegalGroundInstances', jsonParser, async (req, res) => {
        const reqBody = req.body
        console.log(reqBody);
        try {
            if (reqBody.dataSubjectRole === 'Customer') {
                const update = await  UPDATE('sap.capire.bookshop.Orders').set({isBlocked:true,maxDeletionDate:reqBody.maxDeletionDate}).where({ customer_ID: reqBody.dataSubjectID})
                if(update > 0) return  res.status(200).send();
            }
            return res.status(500).send();
        } catch (e) {
            console.log(e);
            return res.status(500).send();
        }
    })
    

    app.post('/drm/deleteDataSubject', jsonParser, async (req, res) => {
        const reqBody = req.body
        console.log(reqBody);
        try {
            if (reqBody.dataSubjectRole === 'Customer') {
                const update = await  UPDATE('sap.capire.bookshop.Customers').set({isBlocked:true,maxDeletionDate:reqBody.maxDeletionDate}).where({ ID: reqBody.dataSubjectID})
                if(update > 0) return  res.status(200).send();
            }
            return res.status(500).send();
        } catch (e) {
            console.log(e);
            return res.status(500).send();
        }
    })
    

    app.post('/drm/destroyLegalGroundInstances', jsonParser, async (req, res) => {
        const reqBody = req.body
        console.log(reqBody);
        try {
            const todate = (new Date()).toISOString();
            if (reqBody.dataSubjectRole === 'Customer' && reqBody.legalGround === 'Order') {
                await  DELETE('sap.capire.bookshop.Orders').where({ maxDeletionDate: {'<': todate}}) /// CDS check for complex where 
                return  res.status(202).send();
            }
            
        } catch (e) {
            console.log(e);
            return res.status(500).send(e);
        }
    })
  

    app.post('/drm/destroyDataSubjects', jsonParser, async (req, res) => {
        const reqBody = req.body
        console.log(reqBody);
        try {
            const todate = (new Date()).toISOString();
            if (reqBody.dataSubjectRole === 'Customer' ) {
                await  DELETE('sap.capire.bookshop.Customers').where({ maxDeletionDate: {'<': todate}}) /// CDS check for complex where 
                return  res.status(202).send();
            }
            
        } catch (e) {
            console.log(e);
            return res.status(500).send(e);
        }
    })


}


