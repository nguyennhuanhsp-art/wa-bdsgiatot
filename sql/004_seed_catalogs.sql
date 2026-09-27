BEGIN;
INSERT INTO bds.countries(code,name) VALUES ('VN','Việt Nam');
INSERT INTO bds.currencies(code,name,minor_units) VALUES
 ('VND','Đồng Việt Nam',0),('USD','Đô la Mỹ',2),('EUR','Euro',2);
INSERT INTO bds.property_types(code,name) VALUES
 ('townhouse','Nhà phố'),('villa','Biệt thự'),('shophouse','Shophouse');
-- Add countries/currencies using verified ISO codes when onboarding international projects.
-- No demo users, passwords, commercial prices, provinces or businesses in production seeds.
COMMIT;
