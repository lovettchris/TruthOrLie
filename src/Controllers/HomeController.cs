using Microsoft.AspNetCore.Mvc;
using TruthOrLie.Firebase;
using TruthOrLie.Models;

namespace TruthOrLie.Controllers
{
    public class HomeController : Controller
    {
        FirebaseSettings _settings;

        public HomeController(FirebaseSettings settings)
        {
            _settings = settings;
        }

        public IActionResult Index()
        {
            var model = new IndexModel(_settings);
            return View(model);
        }

        public IActionResult Privacy()
        {
            return View();
        }
    }
}
