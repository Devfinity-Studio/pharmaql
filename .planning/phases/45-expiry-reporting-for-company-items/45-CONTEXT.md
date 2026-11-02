# Phase 45: Expiry Reporting for Company Items - Context

## Executive Summary
Implementation of the official Technomax ERP Expiry Stock Statement (`rptExpiryStockStatement`) across PharmaQL.

## Official Procedure Definition

### Invocation Signature
```sql
CALL `rptExpiryStockStatement`({d 'YYYY-MM-DD'}, 11, 11, 202627, '(''COMPCODE'')', '', 'PRate')
```

### Parameter Map (7 parameters)
1. `p_AsonDt` (DATE): `{d 'YYYY-MM-DD'}` — Expiry cutoff date (evaluates `h.ExpDt < p_AsonDt`).
2. `p_CmpNo` (INT): `11` (Company No).
3. `p_LocNo` (INT): `11` (Location No).
4. `p_YearNo` (INT): `202627` (Financial Year).
5. `p_CompCode` (LONGTEXT): Format `'(''COMPCODE'')'`, e.g. `'(''AAGAM'')'` or empty string.
6. `p_Div` (LONGTEXT): Division filter format `'(12)'` or empty string `''` for all divisions.
7. `p_Rate` (VARCHAR): `'PRate'` | `'PTR'` | `'MRP'` (defaults to `'PRate'`).

### Stored Procedure Implementation
```sql
BEGIN
	DECLARE v_CompanyJoin 	LONGTEXT;
	DECLARE v_DivisionJoin 	LONGTEXT;

	set v_CompanyJoin='';
	Drop Temporary Table if exists `Company`;
	if p_CompCode<>'' then
		CREATE temporary TABLE Company (MktBy varchar(30) NOT NULL, index(MktBy));
		Set @Qry1=concat('INSERT INTO Company VALUES ', p_CompCode);
		PREPARE stmt1 FROM @Qry1;
		EXECUTE stmt1;
		DEALLOCATE PREPARE stmt1;
		if (select count(*) from Company)<>0 then
			set v_CompanyJoin = ' inner join Company on mi.MktBy = Company.MktBy ';
		End if;	
	End if;
	
	set v_DivisionJoin='' ;
	Drop Temporary Table if exists `Division`;
	if p_Div<>'' then
		CREATE temporary TABLE Division (Division INT NOT NULL,index(Division) );
		Set @Qry1=concat('INSERT INTO Division VALUES ', p_Div);
		PREPARE stmt1 FROM @Qry1;
		EXECUTE stmt1;
		DEALLOCATE PREPARE stmt1;
		if (select count(*) from Division)<>0 then
			set v_DivisionJoin = ' inner join Division on mi.DivisionId = Division.Division ';
		End if;	
	End if;
	
	Set @s=Concat('select h.ID, mi.MktBy,  mi.Division, mi.ItemCode, mi.ItemName, CONCAT(mi.Packing, IFNULL(mi.BaseUnit,'''')) as Packing, h.BatchNo, 
		max(h.MRP) as MRP, max(h.PRate) as PRate, max(h.PTR) as PTR, h.ExpDt, l.Godown, sum(l.OpnQty + l.InQty + l.HoldQty - l.OutQty) as Qty,
		Case 
					WHEN ''',p_Rate,''' = ''MRP'' then max(Mrp)
					WHEN ''',p_Rate,''' = ''PTR'' then max(PTR)
					WHEN ''',p_Rate,''' = ''PRate'' then Max(PRate) END AS Rate
	from h_batch as h
		inner join itembatchstock as l on l.Batchid=h.ID and l.ItemId=h.ItemID and l.CmpNo=h.CmpNo and l.LocNo=h.LocNo
		inner join m_item as mi on mi.ID=l.ItemId',v_CompanyJoin,v_DivisionJoin,'
	WHERE 
		h.CmpNo=',p_CmpNo,' and h.LocNo=',p_LocNo,' and h.YearNo<=',p_YearNo,'
	group by
		h.ID, mi.MktBy, mi.Division, mi.ItemCode, mi.ItemName, CONCAT(mi.Packing, IFNULL(mi.BaseUnit,'''')), h.BatchNo, h.ExpDt, l.Godown
	having 
		sum(l.OpnQty + l.InQty + l.HoldQty - l.OutQty)>0 and h.ExpDt < ''',p_AsonDt,''';');
		
	PREPARE Finalstmt FROM @s;
	EXECUTE Finalstmt;
	DEALLOCATE PREPARE Finalstmt;	

	DROP TEMPORARY TABLE IF EXISTS `Company`;
	DROP TEMPORARY TABLE IF EXISTS `Division`;	
END
```

### Result Schema & Field Types
- `ID`: number (batch ID)
- `MktBy`: string (Marketing company / manufacturer)
- `Division`: string (Division name)
- `ItemCode`: string (Product code)
- `ItemName`: string (Product brand name)
- `Packing`: string (e.g. `10X10 TAB`, `100 ML`)
- `BatchNo`: string (Manufacturer batch identifier)
- `MRP`: number (Maximum retail price)
- `PRate`: number (Purchase rate)
- `PTR`: number (Price to retailer)
- `ExpDt`: date/string (Batch expiration date)
- `Godown`: string/number (Storage location)
- `Qty`: number (Closing positive batch quantity)
- `Rate`: number (Resolved valuation rate based on `p_Rate`)
- `Amount`: number (Calculated as `Qty * Rate` or `Qty * PTR`)
