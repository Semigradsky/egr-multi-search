const express = require('express');
const bodyParser = require('body-parser');
const rp = require('request-promise');
const cheerio = require('cheerio');
const exphbs = require('express-handlebars');

const app = express();

app.set('port', (process.env.PORT || 5000));

app.engine('handlebars', exphbs({ defaultLayout: 'main' }));
app.set('view engine', 'handlebars');

app.use(bodyParser.urlencoded({ extended: false }));

app.use(express.static('public'));

const parsePage = name => html => {
	if (html.indexOf('Ничего не найдено') >= 0) {
		return {
			name: name,
			data: null
		};
	}

	const $ = cheerio.load(html);

	const parseInfo = (_, el) => {
		const state = $(el).find('td:nth-child(6)').text();
		return {
			regNumber: $(el).find('td:nth-child(2)').text(),
			name: $(el).find('td:nth-child(3)').text(),
			regAuthority: $(el).find('td:nth-child(4)').text(),
			reqDate: $(el).find('td:nth-child(5)').text(),
			state,
			expDate: $(el).find('td:nth-child(7)').text(),
			expired: state.indexOf('Исключен из ЕГР') >= 0,
			valid: state.indexOf('Действующий') >= 0
		};
	};

	return {
		name: name,
		data: $('#content table tr:not(:first-child)').map(parseInfo).get()
	};
};

const parseTable = name => html => {
	if (html.length < 10) {
		return {
			name: name,
			data: null
		};
	}

	const $ = cheerio.load(html);

	const parseInfo = (_, el) => {
		return {
			unpNumber: $(el).find('td:nth-child(1)').text(),
			name: $(el).find('td:nth-child(2)').text(),
			reqDate: $(el).find('td:nth-child(3)').text(),
			reason: $(el).find('td:nth-child(4)').text(),
			dfrDate: $(el).find('td:nth-child(5)').text(),
			periodTime: $(el).find('td:nth-child(5)').text()
		};
	};

	return {
		name: name,
		data: $('tr').map(parseInfo).get()
	};
};

app.get('/', (req, res) => res.render('index'));

app.post('/search', (req, res) => {
	const names = req.body.names
		.replace(/\r/g, '')
		.split('\n')
		.filter(x => !!x);

	let getInfo,
		parseResult;

	if (req.body.source === 'egr.gov.by/egrn') {
		getInfo = name => rp('http://egr.gov.by/egrn/index.jsp?content=Find&fmax=1000&vname=' + encodeURIComponent(name));
		parseResult = parsePage;
	}
	if (req.body.source === 'portal.nalog.gov.by/ngb') {
		getInfo = name => rp({
			method: 'POST',
			uri: 'http://www.portal.nalog.gov.by/ngb/data/',
			form: {
				elementID: 'find_pname_reestr',
				begin_between: 1,
				end_between: 1000,
				pname: name
			}
		});
		parseResult = parseTable;
	}

	Promise.all(
		names.map(name => getInfo(name).then(parseResult(name)))
	).then(data => {
		res.render(req.body.source, { results: data });
	}).catch(err => {
		console.error(err);
	});

})

app.listen(app.get('port'), () => {
	console.log(`Example app listening on port ${app.get('port')}!`);
});
