namespace sap.capire.bookshop;
using { Currency, managed, cuid } from '@sap/cds/common';

entity Books : managed {
  key ID : Integer;
  title  : localized String(111);
  descr  : localized String(1111);
  author : Association to Authors;
  stock  : Integer;
  price  : Decimal(9,2);
  currency : Currency;
}

entity Authors : managed {
  key ID : Integer;
  name   : String(111);
  dateOfBirth  : Date;
  dateOfDeath  : Date;
  placeOfBirth : String;
  placeOfDeath : String;
  books  : Association to many Books on books.author = $self;
}
entity LegalEntities {
    Key ID : Integer;
    Key role : String(50);
    Key description: String(100);
}
entity Customers : managed {
    Key ID : Integer;
    name : String(111);
    isBlocked : Boolean; 
    orders : Association to many Orders on orders.customer = $self;
}

entity Orders : cuid, managed {
  OrderNo  : String @title:'Order Number'; //> readable key
  Items    : Composition of many OrderItems on Items.parent = $self;
  status  : String(10) ;
  paymentDate : Timestamp;
  total    : Decimal(9,2) ;
  currency : Currency;
  customer : Association to Customers; 

}

entity OrderItems : cuid {
  parent    : Association to Orders;
  book      : Association to Books;
  amount    : Integer;
  netAmount : Decimal(9,2);
}
