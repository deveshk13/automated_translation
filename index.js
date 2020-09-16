var request = require('request');
var fs = require('fs');
var path = require('path');
const readline = require('readline');
const { put } = require('request');
function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }))
}

var origFile = (process.argv[2])
var origFileName = path.basename(origFile)
var srcLoc = process.argv[3] == undefined ? 'en-US' : process.argv[3]
var tarLoc = process.argv[4] == undefined ? 'hi-IN' : process.argv[5]
var HOST = 'http://localhost:8732';
var APIKEY='AIzaSyDqhuSWNjps546X6NvM9EGYRgYCNBwxK-s';
var SPLIT='XXXXXXXXX';

var srcLocKey = process.argv[3] == undefined ? 'english' : process.argv[4]
var tarLocKey = process.argv[4] == undefined ? 'hindi' : process.argv[6]


var options = {
    'method': 'POST',
    'url': `${HOST}/AutomationService/original2xliffsegments`,
    'headers': {
    },
    formData: {
        'documentContent': {
            'value': fs.createReadStream(origFile),
            'options': {
                'filename': origFileName,
                'contentType': null
            }
        },
        'sourceLocale': srcLoc,
        'targetLocale': tarLoc
    }
};



function original2xliffsegments(options) {

    request(options, function (error, response) {
        if (error) throw new Error(error);


        // console.log(response.body);
        var toTranslateJson = JSON.parse(response.body);
        console.log('Convert to xliff segments success : No. of segments = ', toTranslateJson.segments.length);
        prepareTranslationJson(toTranslateJson)


    });

}


function prepareTranslationJson(segmentsResp) {


    var segments = segmentsResp.segments;
    var transJs = {
        data: []
    }
    segments.forEach(seg => {
        transJs.data.push({
            [srcLocKey]: seg,
            [tarLocKey]: seg
        })
    })

    fs.writeFileSync('translation_tmp.json', JSON.stringify(transJs, null, 2))
    console.log('Wrote to translation_tmp.json')
    doTranslation('translation_tmp.json')

}

async function doTranslation(trans_file) {

    const ans = await askQuestion("Press 1 after manual translation of translation_tmp.json \nPress 2 for Google Translate ? ");
    if (ans == 2) {
        googleTranslation(trans_file)
    }
    else {
        mergeFile(trans_file);
    }
}

function googleTranslation(trans_file) {


    console.log('Preparing for translation via google translate')
    var jstr=fs.readFileSync(trans_file)
    var data=JSON.parse(jstr).data;
    var totr='';
    var i=0;
    data.forEach(seg=>{
        seg=seg[srcLocKey]
        i++;
        totr=totr+seg+SPLIT;

    })
    console.log('Sending to Translate segments ',i)
    var target=tarLoc.split('-')[0]
    console.log(target)
    var options = {
        'method': 'POST',
        'url': `https://translation.googleapis.com/language/translate/v2?key=${APIKEY}`,
        'headers': {
        },
        body:JSON.stringify({
            q:totr,
            target:target
        },null,2)
    };
    request(options, function (error, response) {
        if (error) throw new Error(error);
        var resp=JSON.parse(response.body)
        var translated = resp.data.translations[0].translatedText;
        var bd= translated.split(SPLIT);
        console.log('Translated segments ',bd.length)

        for(var j=0;j<bd.length;j++){
            if(data[j] && data[j][tarLocKey])
                data[j][tarLocKey]=bd[j]
        } 

        fs.writeFileSync(trans_file,JSON.stringify({data:data},null,2))
        mergeFile(trans_file)
    });



}

function mergeFile(trans_file) {

    var options = {
        'method': 'POST',
        'url': HOST + '/AutomationService/xliff2originalsegments',
        'headers': {
        },
        formData: {
            'documentContent': {
                'value': fs.createReadStream(origFile),
                'options': {
                    'filename': origFileName
                }
            },
            'translationContent': {
                'value': fs.createReadStream('./' + trans_file),
                'options': {
                    'filename': trans_file
                }
            },
            'sourceLocale': srcLoc,
            'targetLocale': tarLoc
        }
    };
    request(options, function (error, response) {
        if (error) throw new Error(error);

        if(response.body.length < 100)
            console.log(response.body)
        parseResponseAndMerge(response.body)

    });

}

function parseResponseAndMerge(body){

    var res = JSON.parse(body)
    var b64string = res[tarLocKey];
    var buf = Buffer.from(b64string, 'base64'); // Ta-da
    try{
        fs.unlinkSync('merged_'+origFileName)
    }catch(e){
        
    }
    fs.writeFileSync('merged_' + origFileName, buf)
    console.log('Translation File Merged')
}

original2xliffsegments(options);
