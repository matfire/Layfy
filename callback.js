import 'materialize-css/dist/css/materialize.min.css';
import 'materialize-css/dist/js/materialize.min';
import * as qs from 'qs'


const query = qs.parse(window.location.search)

localStorage.setItem("spotify-access", query["?access"])
localStorage.setItem("spotify-refresh", query["refresh"])

window.close()