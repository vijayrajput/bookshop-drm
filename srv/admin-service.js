const cds = require('@sap/cds')
//const { OrderItems } = cds.entities

/** Service implementation for CatalogService */
module.exports = cds.service.impl(function () {
    this.after('READ', 'Orders', async (orders) => {
        for (let each of orders) {
            const items = await SELECT.from('sap.capire.bookshop.OrderItems',[ 'amount', 'netAmount']).where({ PARENT_ID: each.ID });
            let total = 0;
            items.forEach(items => {
                total = total + (items.amount * items.netAmount);
            })
            each.total = total;
        }
    }) 

    this.on('payment',  async (req) => {
        try{
        const order = await cds.transaction(req).run(SELECT.one.from('AdminService.Orders').where({ ID: req.data.orderID}));
        console.log(order);
        if(order == null || order == undefined)
        {
            req.error (409, `Invalid OrderID `)
            return;
        }
        if(order.status === 'paid')
        {
            req.error (409, `Already Paid`)
            return;
        }
        const newStatus = 'paid';
        const paymentDate = (new Date()).toISOString();
      //  console.log(paymentDate);
      //  console.log(req.data);
        await cds.transaction(req).run( UPDATE('sap.capire.bookshop.Orders').set({status:newStatus,paymentDate: paymentDate}).where({ ID: req.data.orderID}))
        //console.log(update);
        req.info('201','Order Update with Payment Information')
      }
      catch(e)
      {
          console.log(e);
          req.error('500',e);
      }
    })

})