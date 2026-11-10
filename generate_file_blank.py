#!/usr/bin/env python3
"""Rebuild the printed content of file.pdf; never copy its images or filled data.

Run: python3 generate_file_blank.py
     python3 generate_file_blank.py --check
Requires the installed PyMuPDF. Synthetic check artifacts stay in a temporary
folder and are deleted; --preview-dir DIR retains synthetic previews for review.
Field names use pN.section.entry. Signatures/seals are paper-only blank spaces.
"""
import argparse
import hashlib
from pathlib import Path
import tempfile
import pymupdf as pdf

ROOT = Path(__file__).resolve().parent
SOURCE_SHA256 = '9782659ec5ac58ee4304806528c3ced3d436b64f0ba7f003ef6047faf2141602'
OUT = ROOT / 'file-blank-fillable.pdf'
W, H = pdf.paper_size('a4')
L, R = 28, W - 28
INK = (0.08, 0.08, 0.08)
LINE = (0.35, 0.35, 0.35)
HEAD = (0.92, 0.92, 0.92)
CHECKLIST = [
    'BOOKING FORM (DULY FILLED & SIGNED)', 'COMMITMENT CHECKLIST',
    'FINANCE PROPOSAL FORM', 'ACCESSORY ORDER FORM',
    'ADDRESS PROOF (XEROX / ORIGINAL)', 'REGISTRATION / RELEASE BANK LETTER',
    'PAN CARD / FORM 60', 'RECEIPTS FOR PAYMENTS', 'AUTHORISATION LETTER',
    'ADDRESS CHANGE REQUEST LETTER', 'INSURANCE', 'FORM 20', 'FORM 21',
    'FORM 22', 'EXISTING VEHICLE RC COPY', 'PASSPORT SIZE PHOTOGRAPH',
]


class Form:
    def __init__(self):
        self.doc = pdf.open()
        self.names = set()
        self.labels = []

    def page(self, number):
        self.p = self.doc.new_page(width=W, height=H)
        self.prefix = f'p{number}.'
        self.scale = .89 if number == 1 else 1
        self.offset = 12 if number == 1 else 0

    def box(self, x, y, w, h, fill=None):
        y, h = y*self.scale+self.offset, h*self.scale
        self.p.draw_rect(pdf.Rect(x, y, x+w, y+h), color=LINE, fill=fill, width=.5)

    def text(self, x, y, w, h, value, size=9, bold=False, center=False):
        # Explicit line breaks preserve source wording while fitting narrow cells.
        font = 'hebo' if bold else 'helv'
        lines = value.split('\n')
        assert max(pdf.get_text_length(s, fontname=font, fontsize=size) for s in lines) <= w-6, value
        y, h = y*self.scale+self.offset, h*self.scale
        size *= .94 if self.scale != 1 else 1
        line_height = size*1.16
        assert len(lines)*line_height <= h, value
        baseline = y+(h-len(lines)*line_height)/2+size
        for line in lines:
            width = pdf.get_text_length(line,fontname=font,fontsize=size)
            self.p.insert_text((x+(w-width)/2 if center else x+3,baseline),
                               line,fontname=font,fontsize=size,color=INK)
            baseline += line_height
        self.labels.append((self.p.number, value))

    def cell(self, x, y, w, h, label='', size=9, bold=False, center=False, fill=None):
        self.box(x,y,w,h,fill)
        if label:
            self.text(x,y,w,h,label,size,bold,center)

    def heading(self, x, y, w, label, h=18, size=10):
        self.cell(x,y,w,h,label,size,True,True,HEAD)

    def field(self, key, x, y, w, h, multiline=False, choices=None, checkbox=False):
        name = self.prefix+key
        assert name not in self.names, name
        self.names.add(name)
        widget = pdf.Widget()
        widget.field_name = name
        widget.field_label = key.replace('.', ' / ').replace('_',' ')
        y, h = y*self.scale+self.offset, h*self.scale
        widget.rect = pdf.Rect(x+2,y+2,x+w-2,y+h-2)
        widget.field_type = (pdf.PDF_WIDGET_TYPE_CHECKBOX if checkbox else
            pdf.PDF_WIDGET_TYPE_COMBOBOX if choices else pdf.PDF_WIDGET_TYPE_TEXT)
        widget.field_value = 'Off' if checkbox else ''
        widget.text_font = 'Helv'
        widget.text_fontsize = 9 if h >= 19 else 8
        widget.text_color = (0,0,0)
        widget.border_width = .5 if checkbox else 0
        widget.border_color = LINE if checkbox else None
        widget.fill_color = None
        widget.field_flags = pdf.PDF_TX_FIELD_IS_MULTILINE if multiline else 0
        widget.field_display = 0  # Visible on screen and printable (annotation /F 4).
        if choices:
            widget.choice_values = ['', *choices]
        self.p.add_widget(widget)

    def entry(self, key, x, y, w, h, label, label_w, size=9, multiline=False):
        self.cell(x,y,label_w,h,label,size)
        self.cell(x+label_w,y,w-label_w,h)
        self.field(key,x+label_w,y,w-label_w,h,multiline)

    def area(self, key, x, y, w, h, label, multiline=True):
        self.box(x,y,w,h)
        self.text(x,y,w,17,label,9)
        self.field(key,x,y+17,w,h-17,multiline)

    def sign(self, x, y, w, h, label):
        self.box(x,y,w,h)
        self.text(x,y+h-16,w,16,label,9,center=True)

    def row_fields(self, section, x, y, widths, labels, keys, height=34):
        for width,label,key in zip(widths,labels,keys):
            self.cell(x,y,width,14,label,8,center=True)
            self.cell(x,y+14,width,height-14)
            self.field(section+'.'+key,x,y+14,width,height-14)
            x += width

    def finish(self, path):
        for page in self.doc:
            # Row-major tab order, independent of construction order.
            widgets = sorted(page.widgets(), key=lambda w: (round(w.rect.y0), w.rect.x0))
            self.doc.xref_set_key(page.xref, 'Annots', '['+' '.join(f'{w.xref} 0 R' for w in widgets)+']')
            self.doc.xref_set_key(page.xref, 'Tabs', '/R')
        self.doc.set_metadata({'title':'Blank customer file', 'subject':'Four-page printable fillable form',
                              'creator':'generate_file_blank.py', 'producer':'PyMuPDF'})
        self.doc.save(path, garbage=4, deflate=True, no_new_id=True, reproducible=True)
        self.doc.close()


def page_one(f):
    f.page(1)
    f.cell(L,24,85,22,'GST Billing')
    f.field('header.gst_billing',L+87,25,19,20,checkbox=True)
    f.cell(385,24,R-385,22,'Permanent / Temporary',8)
    f.field('header.registration_type',385,46,R-385,22,choices=['Permanent','Temporary'])
    f.box(385,46,R-385,22)
    f.entry('header.so_name',L,68,178,22,'SO Name :',61)
    f.entry('header.customer_code',L,90,178,22,'Cust Code',61)
    f.entry('header.booking_no',L,112,178,22,'Booking No',61)
    f.cell(206,68,179,66)
    f.text(206,76,179,25,'NIPPON TOYOTA',16,True,True)
    f.text(206,103,179,22,'CUSTOMER FILE',12,True,True)
    f.entry('header.tl_name',385,68,R-385,22,'TL Name :',60)
    f.entry('header.enquiry_no',385,90,R-385,22,'Enquiry No.',60)
    f.entry('header.date',385,112,R-385,22,'Date',60)
    # The source has a blank cell under Booking No, beside the section heading.
    f.cell(L,134,178,18)
    f.field('header.unlabelled_reference',L,134,178,18)
    f.heading(206,134,R-206,'BOOKING DETAILS')
    f.entry('booking.customer_name',L,152,R-L,23,'Customer Name',152)
    f.cell(L,175,178,21,'Communication Address :')
    f.entry('booking.contact_person',206,175,R-206,21,'Contact Person',90)
    f.box(L,196,R-L,53)
    f.field('booking.communication_address',L,196,R-L,32,True)
    f.text(408,228,32,21,'Pin',8)
    f.field('booking.pin',440,228,R-440,21)
    f.row_fields('booking',L,249,[83,87,86,95,95,93],
                 ['Model','Suffix 1','Suffix 2','Colour 1','Colour 2','Interior Colour'],
                 ['model','suffix_1','suffix_2','colour_1','colour_2','interior_colour'])
    f.entry('booking.special_request',L,283,R-L,25,'Special Request',105)
    f.sign(L,308,(R-L)/2,30,'SO Sign')
    f.sign((L+R)/2,308,(R-L)/2,30,'TL Sign')
    f.heading(L,338,R-L,'REGISTRATION')
    f.entry('registration.customer_name',L,356,R-L,22,'Customer Name',143)
    f.entry('registration.relation_designation',L,378,310,22,'S/o - D/o - W/o - Designation',143,8)
    f.entry('registration.rto_name',338,378,R-338,22,'RTO Name',68)
    f.area('registration.permanent_address',L,400,269,65,'Permanent Address :')
    f.area('registration.temporary_address',297,400,270,65,'Temporary Address :')
    f.entry('registration.permanent_pin',L,465,269,20,'Pin',180,8)
    f.entry('registration.temporary_pin',297,465,270,20,'Pin',180,8)
    for x,width,label,lw,key in [(L,180,'Model',55,'model'),(208,180,'Suffix',55,'suffix'),(388,179,'Colour',55,'colour')]:
        f.entry('registration.'+key,x,485,width,22,label,lw)
    f.entry('registration.mobile_adhar',L,507,269,22,'Mobile No. (Adhar)',116,8)
    f.entry('registration.mobile_fastag',297,507,270,22,'Mobile No. (Fastag)',116,8)
    f.entry('registration.email',L,529,300,22,'E-mail',50)
    f.entry('registration.pan',328,529,R-328,22,'PAN No :',60)
    f.heading(L,551,315,'FINANCE')
    f.cell(343,551,R-343,18,'Dir DSA / Customer',8)
    f.field('finance.source',451,551,R-451,18,choices=['Dir DSA','Customer'])
    f.entry('finance.hypothecation_branch',L,569,R-L,22,'Hypothecation (with branch)',180,8)
    f.heading(L,591,R-L,'INSURANCE')
    for x,width,label,choices,key in [(L,180,'Nippon / Direct',['Nippon','Direct'],'channel'),
            (208,180,'Private / Taxi',['Private','Taxi'],'use'),(388,179,'NCB: Yes / No',['Yes','No'],'ncb')]:
        f.cell(x,609,width,19,label,8)
        f.cell(x,628,width,19)
        f.field('insurance.'+key,x,628,width,19,choices=choices)
    f.entry('insurance.special_request',L,647,269,23,'Special Request',99,8)
    f.entry('insurance.driving_licence',297,647,270,23,'Driving Licence No.',116,8)
    f.heading(L,670,R-L,'Nominee Details',16,9)
    for x,width,label,lw,key in [(L,239,'Name :',48,'name'),(267,110,'Age :',36,'age'),(377,190,'Relation :',62,'relation')]:
        f.entry('nominee.'+key,x,686,width,22,label,lw)
    f.heading(L,708,R-L,'DELIVERY',16,9)
    f.entry('delivery.date',L,724,269,20,'Date',55)
    f.entry('delivery.time',297,724,270,20,'Time',55)
    f.entry('delivery.discount_details',L,744,R-L,20,'Discount Details',108,8)
    f.sign(L,764,269,27,'SO Sign')
    f.sign(297,764,270,27,'TL Sign')


def page_one_allotment(f):
    # Page 1 uses a compact vertical scale to fit all original sections.
    f.heading(L,791,R-L,'ALLOTMENT only for office use',18,9)
    for x,width,label,lw,key in [(L,180,'Model',50,'model'),(208,180,'Suffix',50,'suffix'),(388,179,'Colour',50,'colour')]:
        f.entry('allotment.'+key,x,809,width,22,label,lw)
    f.entry('allotment.chassis_no',L,831,R-L,22,'Chassis No',88)
    f.entry('allotment.engine_no',L,853,269,22,'Engine No',88)
    f.cell(297,853,270,44)
    f.text(297,853,270,17,'RTO Application No:',9)
    f.field('allotment.rto_application_no',297,870,270,27)
    f.entry('allotment.allotment_no',L,875,269,22,'Allotment No.',88)


def page_two(f):
    f.page(2)
    f.heading(L,28,R-L,'CUSTOMER LEDGER',23,13)
    f.entry('header.customer_name',L,51,285,24,'CUSTOMER NAME :',110,8)
    f.entry('header.chassis_no',313,51,254,24,'CHASSIS NO :',84,8)
    x, a, b = L, 252, 279
    f.heading(x,75,a,'PRICES')
    prices = [('MODEL / VARIANT','model_variant'),('EX SHOWROOM','ex_showroom'),('TCS','tcs'),
        ('INSURANCE','insurance'),('ROAD TAX','road_tax'),('EXTENDED WARRANTY','extended_warranty'),
        ('SMILES','smiles'),('RTO FEES','rto_fees'),('FASTAG','fastag'),('VTD','vtd'),
        ('BASIC ACC (F+M)','basic_accessories'),('','unlabelled'),('TOTAL - (A)','total_a'),
        ('ACCESSORIES BILL - (B)','accessories_b'),('GRAND TOTAL - (A+B)=C','grand_total_c')]
    for i,(label,key) in enumerate(prices):
        f.entry('prices.'+key,x,93+i*26,a,26,label,139,8)
    px=288
    f.heading(px,75,b,'CUSTOMER PAYMENTS')
    widths=[47,49,110,73]
    xx=px
    for width,label in zip(widths,['RECPT No.','RECEPT Dt.','PARTICULARS\n(Cash/DD/CHQ/FT)','AMOUNT']):
        f.cell(xx,93,width,27,label,7,center=True); xx+=width
    for row in range(10):
        xx=px
        for width,key in zip(widths,['receipt_no','receipt_date','particulars','amount']):
            f.cell(xx,120+row*18,width,18)
            f.field(f'payments.row_{row+1:02}.{key}',xx,120+row*18,width,18)
            xx+=width
    for xx,width,key in [(px,47,'total_receipt_no'),(px+47,49,'total_receipt_date')]:
        f.cell(xx,300,width,22); f.field('payments.'+key,xx,300,width,22)
    f.cell(px+96,300,110,22,'TOTAL - (D)',8,True,True)
    f.cell(px+206,300,73,22); f.field('payments.total_d',px+206,300,73,22)
    f.entry('payments.discount_e',px,322,b,28,'DISCOUNTS - TO BE DEDUCTED FROM SALES\nINVOICE - (E)',206,7.3)
    f.cell(px,350,206,34,'DISCOUNT APPROVAL SIGNATURE',7.6,center=True)
    f.box(px+206,350,73,34)
    f.entry('payments.total_received_f',px,384,b,24,'TOTAL AMOUNT RECEIVED - (D+E)=F',206,7.6)
    xx=px
    for width,label in zip(widths,['ACC\nRECPT NO.','RECPT Dt.','PARTICULARS\n(Cash/DD/CHQ/FT)','AMOUNT (G)']):
        f.cell(xx,408,width,25,label,7,center=True); xx+=width
    xx=px
    for width,key in zip(widths,['receipt_no','receipt_date','particulars','amount_g']):
        f.cell(xx,433,width,23); f.field('accessory_payment.'+key,xx,433,width,23); xx+=width
    f.entry('payments.total_including_accessory_h',px,456,b,28,'AMOUNT RECEIVED INCLUDING ACCESSORY\n(F+G)=H',206,7.5)
    f.entry('payments.excess_refund',L,490,R-L,24,'EXCESS AMOUNT DUE FOR REFUND - (H-C)',361,9)
    f.heading(L,530,R-L,'PROVISIONAL APPROVAL',21,12)
    f.cell(L,551,270,27,'Existing Customer :   Yes / No',9)
    f.field('provisional.existing_customer',214,551,84,27,choices=['Yes','No'])
    f.entry('provisional.vehicle_count',298,551,269,27,'No. of Vehicle :',118)
    f.heading(L,578,R-L,'COMPLIMENTARY / DISCOUNT NOTE',20,10)
    for xx,width,label in [(L,28,'Sl. No.'),(56,162,'PARTICULARS'),(218,90,'AMOUNT')]:
        f.cell(xx,598,width,22,label,7 if width==28 else 9,True,True)
    f.cell(L,620,190,19,'CASH/VAS',9,True,True)
    f.cell(218,620,90,19); f.field('discount.cash_vas_amount',218,620,90,19)
    for i in range(4):
        y=639+i*23
        f.cell(L,y,28,23,str(i+1),9,center=True)
        f.cell(56,y,162,23); f.field(f'discount.row_{i+1}.particulars',56,y,162,23)
        f.cell(218,y,90,23); f.field(f'discount.row_{i+1}.amount',218,y,90,23)
    for y,label,key in [(731,'TOTAL (G)','total_g'),(753,'Additional Discount','additional'),(775,'TOTAL','total')]:
        f.entry('discount.'+key,L,y,280,22,label,190,9)
    f.area('provisional.source_of_enquiry',314,598,142,46,'Source of Enquiry :')
    f.area('provisional.referred_by',314,644,142,46,'Referred by :')
    f.cell(314,690,142,23,'Taxi / Pvt',9,center=True)
    f.cell(314,713,142,18)
    f.field('provisional.vehicle_use',314,713,142,18,choices=['Taxi','Pvt'])
    f.cell(456,598,111,133)
    f.text(456,598,111,20,'Customer Photo',9,center=True)
    f.heading(314,731,253,'OTHER NEGOTIATIONS & REMARKS',18,8)
    f.box(314,749,253,48); f.field('provisional.remarks',314,749,253,48,True)
    for i,label in enumerate(['Sales Officer','Team Leader','Sales Manager','Accounts Manager']):
        f.sign(L+i*(R-L)/4,800,(R-L)/4,32,label)


def page_three(f):
    f.page(3)
    left,right=222,309
    f.heading(L,28,left,'FINANCE CALCULATION')
    for i,(label,key) in enumerate([('FINANCE COMPANY','company'),('DSA / DMA','dsa_dma'),
            ('COMMISSION','commission'),('SUBVENTION','subvention'),('BALANCE (A)','balance_a')]):
        f.entry('finance.'+key,L,46+i*23,left,23,label,120,8)
    f.heading(258,28,right,'INSURANCE CALCULATION')
    for i,(label,key) in enumerate([('INSURANCE COMPANY','company'),('INSURANCE AMOUNT','amount'),('INSURANCE COMMISSION (B)','commission_b')]):
        f.entry('insurance.'+key,258,46+i*38.333,right,38.333,label,174,8)
    f.heading(L,169,left,'TKM SUPPORT')
    for i,(label,key) in enumerate([('NON TARGET LINKED','non_target_linked'),('TARGET LINKED','target_linked'),('TOTAL','total')]):
        f.entry('tkm_support.'+key,L,187+i*23,left,23,label,120,8)
    f.heading(258,169,right,'INVOICE DETAILS')
    f.cell(258,187,87,69,'INVOICE NO &\nDATE',9,True,True)
    for x,key,label in [(345,'tdms','TDMS'),(456,'tally','TALLY')]:
        f.cell(x,187,111,23,label,9,True,True)
        f.cell(x,210,111,46); f.field('invoice.'+key,x,210,111,46,True)
    f.heading(L,264,left,'INCENTIVE TO DEPT')
    for i,(label,key) in enumerate([('VEHICLE (SO)','vehicle_so'),('INSURANCE','insurance'),('FINANCE','finance'),('ACCESSORIES','accessories'),('','unlabelled'),('TOTAL (F)','total_f')]):
        y=282+i*22
        if i in [1,2,3]:
            f.cell(L,y,120,22,label,8)
            for j in range(2):
                f.cell(L+120+j*51,y,51,22)
                f.field(f'incentive.{key}_{j+1}',L+120+j*51,y,51,22)
        else:
            f.entry('incentive.'+key,L,y,left,22,label,120,8)
    f.area('remarks.calculation',258,264,right,150,'REMARKS :')
    f.box(L,422,R-L,114)
    f.text(L+6,427,14,19,'I',9)
    f.field('cheque.responsible_person',L+20,427,160,19)
    f.text(L+180,427,R-L-186,19,'take the responsibility for the personal cheque / DD issue by the customer',8)
    for x,width,label,key in [(L+12,140,'Rs.','amount'),(212,160,'Chq/DD No.','reference'),(410,145,'Date','date')]:
        f.area('cheque.'+key,x,451,width,38,label,multiline=False)
    f.sign(L+38,495,180,35,'SO / TL')
    f.sign(347,495,180,35,'Sales Manager')
    f.heading(L,544,260,'ACCESSORY DETAILS')
    f.entry('accessories.sales',L,562,260,22,'SALES',105)
    f.entry('accessories.unlabelled',L,584,260,22,'',105)
    f.entry('accessories.margin_c',L,606,260,22,'MARGIN (C)',105)
    f.heading(L,636,260,'INTEREST CALCULATION')
    for i,(label,key) in enumerate([('DATE OF BOOKING','booking_date'),('DATE OF DELIVERY','delivery_date'),
            ('NO. OF DAYS','number_days'),('LESS 7 DAYS','less_7_days'),('EFFECTIVE DAYS\nFOR INTEREST','effective_days')]):
        f.entry('interest.'+key,L,654+i*22,260,22,label,130,8)
    totals_left=['A (Finance)','B (Insurance)','C Accessories)','VEH. MGN','TKM SUP','OTHERS','TOTAL']
    totals_right=['F (Incentive)','G (Discount)','ACC INC','ADMN INC','KMPL INT','OTHERS','TOTAL']
    for i in range(7):
        for x,labels,key in [(296,totals_left,'income'),(432,totals_right,'deduction')]:
            f.entry(f'totals.{key}_{i+1}',x,544+i*27,135,27,labels[i],72,8)
    f.entry('totals.nett',296,733,271,31,'NETT:',136,14)
    for i,label in enumerate(['SALES DEPT.','ACCESSORY DEPT.','INSURANCE DEPT.','ACCOUNTS DEPT.']):
        f.sign(L+i*(R-L)/4,777,(R-L)/4,42,label)


def page_four(f):
    f.page(4)
    f.heading(L,28,R-L,'INTIMATION OF CHANGES IN BOOKING',22,12)
    f.box(L,50,R-L,206)
    f.entry('changes.booking_no',L+6,57,350,23,'BOOKING No.',205)
    for y,label,key in [(86,'BOOKING RECEIVED','received'),(112,'CHANGED TO','changed')]:
        f.text(L+6,y,175,23,label,9)
        f.entry('changes.'+key+'_model',209,y,180,23,'MODEL',48,8)
        f.entry('changes.'+key+'_colour',395,y,166,23,'COLOUR',52,8)
    f.text(L+6,142,253,20,'CUSTOMER NAME AND ADDRESS AT THE TIME OF BOOKING',7.2)
    f.field('changes.original_name_address',285,140,276,41,True)
    f.text(L+6,184,245,20,'CHANGED NAME AND ADDRESS',9)
    f.field('changes.changed_name_address',285,182,276,41,True)
    for x,label in [(L,'Sales Executive Sign'),(208,'TL Sign'),(388,'Sales Manager')]:
        f.text(x,236,179,18,label,9,center=True)
        f.p.draw_line((x+20,234),(x+159,234),color=LINE,width=.5)
    f.heading(L,267,284,'REGISTRATION DOCUMENTS',23,12)
    f.cell(318,267,249,23,'PERMANENT / TEMPORARY',9,True)
    f.cell(318,290,249,22)
    f.field('registration_documents.registration_type',318,290,249,22,choices=['PERMANENT','TEMPORARY'])
    f.text(348,312,219,20,'REMARKS',9,center=True)
    for i,label in enumerate(CHECKLIST):
        y=332+i*21
        f.text(L,y,24,21,f'{i+1}.',8)
        f.text(L+24,y,264,21,label,8)
        f.field(f'registration_documents.item_{i+1:02}.checked',321,y+1,19,19,checkbox=True)
        f.field(f'registration_documents.item_{i+1:02}.remarks',348,y,219,21)
        f.p.draw_line((348,y+21),(R,y+21),color=LINE,width=.5)
    f.area('delivery.remarks',L,676,R-L,72,'DELIVERY REMARKS :')
    for x,y,label in [(L,755,'ACCESSORY IN CHARGE'),(207,755,'SALES OFFICER'),
            (L,793,'SALES MANAGER'),(207,793,'DELIVERY IN CHARGE')]:
        f.text(x,y+17,170,17,label,9)
    f.heading(388,755,179,'SECURITY CHECKING',17,9)
    for i,(label,key) in enumerate([('NAME :','name'),('DATE :','date'),('TIME :','time')]):
        f.entry('security.'+key,388,772+i*16,179,16,label,50,8)
    f.cell(388,820,179,16,'SEAL & SIGN',8)


def generate(path=OUT):
    f=Form()
    page_one(f)
    page_one_allotment(f)
    page_two(f)
    page_three(f)
    page_four(f)
    f.finish(path)
    return f.labels


def check(path, labels, preview_dir=None):
    source=ROOT/'file.pdf'
    assert hashlib.sha256(source.read_bytes()).hexdigest()==SOURCE_SHA256, 'Original changed'
    d=pdf.open(path)
    assert len(d)==4
    names=set(); counts=[]; expected={}; appearances={}; blank_boxes={}; multiline_count=checkbox_count=choice_count=0
    for page in d:
        assert page.rect == pdf.Rect(0,0,W,H)
        assert not page.get_images(full=True)
        assert not list(page.annots() or [])
        assert d.xref_get_key(page.xref,'Tabs')[1]=='/R'
        ws=list(page.widgets()); counts.append(len(ws))
        for w in ws:
            assert w.field_name not in names
            names.add(w.field_name)
            assert page.rect.contains(w.rect), (w.field_name,w.rect)
            assert int(d.xref_get_key(w.xref,'F')[1]) & 4, w.field_name
            assert not any([w.script,w.script_calc,w.script_change,w.script_format,w.script_stroke])
            if w.field_type==pdf.PDF_WIDGET_TYPE_CHECKBOX:
                assert w.field_value in ('Off',False,0,'')
                value=w.on_state(); checkbox_count+=1
                blank_boxes[w.field_name]=page.get_pixmap(clip=w.rect).samples
            elif w.field_type==pdf.PDF_WIDGET_TYPE_COMBOBOX:
                assert not w.field_value
                value=w.choice_values[1]; choice_count+=1
            else:
                assert not w.field_value
                if w.field_flags & pdf.PDF_TX_FIELD_IS_MULTILINE:
                    value='TEST LINE 1\nTEST LINE 2'; multiline_count+=1
                else:
                    key=w.field_name
                    value=('10/11/2026' if 'date' in key else
                           '12345.67' if any(t in key for t in ['amount','total','price','commission','balance','refund']) else
                           'TEST CUSTOMER' if key.endswith(('customer_name','so_name','tl_name')) else '1234')
            expected[w.field_name]=value
            appearances[w.field_name]=(page.number,pdf.Rect(w.rect),w.field_type)
        text=' '.join(page.get_text().split())
        for p,label in labels:
            if p==page.number:
                assert ' '.join(label.split()) in text, ('Missing printed label',p+1,label)
        for block in page.get_text('dict')['blocks']:
            for line in block.get('lines',[]):
                for span in line['spans']:
                    assert page.rect.contains(pdf.Rect(span['bbox'])),span['text']
    assert len([n for n in names if n.startswith('p4.registration_documents.item_') and n.endswith('.checked')])==16
    assert not d.embfile_count()
    assert not d.get_xml_metadata()
    assert set(v for v in d.metadata.values() if v) <= {'PDF 1.7','Blank customer file','Four-page printable fillable form','generate_file_blank.py','PyMuPDF','None'}
    with tempfile.TemporaryDirectory(prefix='filesdigi-check-') as temp:
        folder=Path(preview_dir or temp); folder.mkdir(parents=True,exist_ok=True)
        if preview_dir:
            for p in d: p.get_pixmap(matrix=pdf.Matrix(1.5,1.5)).save(folder/f'blank-{p.number+1}.png')
        for page in d:
            for w in page.widgets():
                w.field_value=expected[w.field_name]; w.update()
        filled=folder/'synthetic-filled.pdf'; d.save(filled); d.close()
        d=pdf.open(filled)
        for page in d:
            for w in page.widgets():
                assert w.field_value==expected[w.field_name], (w.field_name,w.field_value)
                assert d.xref_get_key(w.xref,'AP')[0]=='dict', w.field_name
                if w.field_type==pdf.PDF_WIDGET_TYPE_CHECKBOX:
                    assert page.get_pixmap(clip=w.rect).samples != blank_boxes[w.field_name]
        # Baking uses saved appearance streams, as printing does; verify entered
        # text survives flattening, including both lines of every multiline field.
        d.bake(annots=True,widgets=True)
        for name,(number,rect,kind) in appearances.items():
            if kind != pdf.PDF_WIDGET_TYPE_CHECKBOX:
                visible=' '.join(d[number].get_text(clip=rect).split())
                assert ' '.join(expected[name].split()) in visible, ('Clipped appearance',name,visible)
        for p in d:
            if preview_dir:
                p.get_pixmap(matrix=pdf.Matrix(1.5,1.5)).save(folder/f'synthetic-{p.number+1}.png')
        d.save(folder/'synthetic-print.pdf'); d.close()
    assert hashlib.sha256(source.read_bytes()).hexdigest()==SOURCE_SHA256
    print(f'PASS: four A4 pages; fields/page={counts}; {len(names)} unique empty fields; '
          f'{checkbox_count} unchecked boxes; {choice_count} blank dropdowns; {multiline_count} multiline fields.')
    print('PASS: printed-label coverage, field bounds, print flags, no images/attachments/scripts, '
          'synthetic save/reopen and flattened appearance; original SHA-256 unchanged.')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check',action='store_true')
    parser.add_argument('--preview-dir',type=Path)
    args=parser.parse_args()
    printed_labels=generate()
    if args.check or args.preview_dir:
        check(OUT,printed_labels,args.preview_dir)
    print(OUT)
