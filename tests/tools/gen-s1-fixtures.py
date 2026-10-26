import json,os,re,subprocess,sys
P=os.environ["KIT_PIPE"]  # .../wp-builder-kit/skill/wp-from-screenshot/tools/pipeline (778e4ed+)
SEC=P+"/examples/law-firm/sections"; OUT=os.environ["OUT"]
env=dict(os.environ,KIT_THEME_JSON=P+"/runtime/themes/kit-base/theme.json")
PAGES={"index":["hero","practice","results","attorneys","trust","consult"],"practice":["pagehero","areas","approach","consult2"]}
kc=0;residue=[]
for page,secs in PAGES.items():
    parts=[]
    for s in secs:
        src=f"{SEC}/{page}-{s}.html"; blk=f"{OUT}/{page}-{s}.blocks.html"; res=f"{OUT}/{page}-{s}.residue.json"
        r=subprocess.run(["python3",P+"/down_convert.py","--html",src,"--media",""+os.environ["MEDIA_PH"]+"","--target","kit","--out",blk,"--residue-out",res],env=env,capture_output=True,text=True)
        if r.returncode: print("FAIL",src,r.stderr[-800:]); sys.exit(1)
        m=open(blk).read()
        ids=sorted({int(x) for x in re.findall(r"kc-(\d+)",m)})
        m=re.sub(r"kc-(\d+)",lambda mm:"kc-%d"%(int(mm.group(1))+kc),m); kc+=(max(ids) if ids else 0)
        if os.path.exists(res):
            for sel,css in json.load(open(res)).items(): residue.append(f"/* {page}-{s} */\n{css}")
        if "FAQ_SLOT" in m:
            items=""
            for q,a in [("What does a first consultation cost?","The first consultation is free."),("How long does a case take?","It depends on the matter.")]:
                items+=('<!-- wp:details {"className":"faq-item"} -->\n<details class="wp-block-details faq-item"><summary>%s</summary><!-- wp:paragraph -->\n<p>%s</p>\n<!-- /wp:paragraph --></details>\n<!-- /wp:details -->\n')%(q,a)
            m=re.sub(r'<!-- wp:paragraph \{"className":"faq-slot"\} -->\s*<p class="faq-slot">FAQ_SLOT</p>\s*<!-- /wp:paragraph -->',items,m)
        parts.append(m); print(page,s,m.count("<!-- wp:"),"blocks",m.count("<!-- wp:kit/"),"kit")
    c="\n".join(parts); assert "wp:html" not in c and 'style="' not in c
    open(f"{OUT}/{page}.page.html","w").write(c)
open(f"{OUT}/residue.css","w").write("\n".join(residue))
