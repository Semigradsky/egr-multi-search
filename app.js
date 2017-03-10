const express = require('express');
const bodyParser = require('body-parser');
const rp = require('request-promise');
const cheerio = require('cheerio');
const exphbs = require('express-handlebars');

const app = express();

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



app.post('/search', (req, res) => {
	const names = req.body.names
		.replace(/\r/g, '')
		.split('\n')
		.filter(x => !!x);

	Promise.all(
		names.map(name => rp('http://egr.gov.by/egrn/index.jsp?content=Find&fmax=1000&vname=' + encodeURIComponent(name)).then(parsePage(name)))
	).then(data => {
		res.render('search', { results: data, layout: false });
	}).catch(err => {
		console.error(err);
	});

})

app.listen(3000, () => {
	console.log('Example app listening on port 3000!');
});
